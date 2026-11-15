// import type { State, View, InteractiveMap, TileProvider } from "./interactive-map.ts"
// import {  } from "./interactive-map.ts"

const TREK_MARS_EQ = "https://trek.nasa.gov/tiles/Mars/EQ"
const MAX_CACHE_SIZE = 512



function firstText(parent: Element, localName: string) {
    const node = parent.querySelector(localName);
    return node ? node.textContent.trim() : null;
}
function readCorner(box: Element, localName: string) {
    const value = firstText(box, localName);
    if (!value) return null;

    const parts = value.trim().split(/\s+/).map(Number);
    if (parts.length < 2) return null;

    const [a, b] = parts;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

    return { a, b };
}



type TyleMatrix = {
    identifier: number,
    scaleDenominator: number,
    topLeftCorner: [number, number] | null,
    tileWidth: number,
    tileHeight: number,
    matrixWidth: number,
    matrixHeight: number
}
function parseTileMatrix(element: Element): TyleMatrix {
    const identifier = Number(firstText(element, "Identifier"))
    const scaleDenominator = Number(firstText(element, "scaleDenominator"))
    const topLeftCorner = readCorner(element, "TopLeftCorner")
    const tileWidth = Number(firstText(element, "TileWidth"))
    const tileHeight = Number(firstText(element, "TileHeight"))
    const matrixWidth = Number(firstText(element, "MatrixWidth"))
    const matrixHeight = Number(firstText(element, "MatrixHeight"))
    return {
        identifier,
        scaleDenominator,
        topLeftCorner: topLeftCorner ? [topLeftCorner.a, topLeftCorner.b] : null,
        tileWidth,
        tileHeight,
        matrixWidth,
        matrixHeight
    }
}



type WMTSCapabilities = {
    template: string,
    format: string,
    style: string,
    matrixSet: string,
    tileMatricies: TyleMatrix[],
    maxLevel: number,
    tileSize: [number, number],
    bounds: [number[], number[]] | null
}
async function fetchWMTSCapabilities(productId: any): Promise<WMTSCapabilities> {
    const url = `${TREK_MARS_EQ}/${encodeURIComponent(productId)}/1.0.0/WMTSCapabilities.xml`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`No WMTS service for "${productId}" (HTTP ${response.status}). Check the layer ID on trek.nasa.gov/mars.`);
    }

    const xml = new DOMParser().parseFromString(
        await response.text(),
        "application/xml"
    );

    const resource = xml.querySelector('ResourceURL[resourceType="tile"]')
    const template = resource && resource.getAttribute("template");
    if (!template) {
        throw new Error(`"${productId}" has no REST tile template.`);
    }

    const tileMatricies = [...xml.getElementsByTagName("TileMatrix")]
        .map(matrix => parseTileMatrix(matrix))

    const tileSize = [tileMatricies[0].tileWidth, tileMatricies[1].tileHeight];
    for (const matrix of tileMatricies) {
        if (matrix.tileWidth !== tileSize[0] || matrix.tileHeight !== tileSize[1]) {
            throw new Error('Supported only WMTS services with uniform tile dimensions!');
        }
    } 

    const levels = tileMatricies
        .map(matrix => matrix.identifier)
        .filter(level => Number.isFinite(level))

    const matrixSet = xml.querySelector("TileMatrixSet:has(Identifier)");

    const style = xml.querySelector("Style");
    const box = xml.querySelector("WGS84BoundingBox");
    const lower = box && readCorner(box, "LowerCorner");
    const upper = box && readCorner(box, "UpperCorner");

    return {
        template,
        format: resource.getAttribute("format") || firstText(xml.documentElement, "Format") || "image/jpeg",
        style: (style && firstText(style, "Identifier")) || "default",
        matrixSet: (matrixSet && firstText(matrixSet, "Identifier")) || "default028mm",
        tileMatricies: tileMatricies,
        maxLevel: levels.length ? Math.max(...levels) : 7,
        tileSize: [tileSize[0], tileSize[1]],
        bounds: lower && upper ? [[lower.b, lower.a], [upper.b, upper.a]] : null
    };
}



type TileKey = string
const tileKey = (x: number, y: number, z: number): TileKey => `${z}/${x}/${y}`

// Tile index range a layer actually has data for, per zoom level.
// Small products declare a global matrix but only publish tiles inside their bbox,
// so anything outside these ranges would be a guaranteed 404.
type LevelLimits = {
    minCol: number,
    maxCol: number,
    minRow: number,
    maxRow: number
}

function levelLimits(capabilities: WMTSCapabilities): Map<number, LevelLimits> {
    const limits = new Map<number, LevelLimits>()
    // bounds is [[minLat, minLon], [maxLat, maxLon]]
    const box = capabilities.bounds

    for (const matrix of capabilities.tileMatricies) {
        const mw = matrix.matrixWidth > 0 ? matrix.matrixWidth : 2 ** (matrix.identifier + 1)
        const mh = matrix.matrixHeight > 0 ? matrix.matrixHeight : 2 ** matrix.identifier

        // no bbox: the whole matrix is fair game
        if (!box) {
            limits.set(matrix.identifier, { minCol: 0, maxCol: mw - 1, minRow: 0, maxRow: mh - 1 })
            continue
        }

        const [minLat, minLon] = box[0]
        const [maxLat, maxLon] = box[1]
        const col = (lon: number) => Math.floor((lon + 180) / 360 * mw)
        const row = (lat: number) => Math.floor((90 - lat) / 180 * mh)

        // every tile the box touches is kept; the box may not cross the antimeridian
        limits.set(matrix.identifier, {
            minCol: Math.max(0, col(minLon)),
            maxCol: Math.min(mw - 1, col(maxLon)),
            minRow: Math.max(0, row(maxLat)),
            maxRow: Math.min(mh - 1, row(minLat)),
        })
    }
    return limits
}

type CachedTileProvider = {
    width: number,
    height: number,
    maxLevel: number,
    capabilities: WMTSCapabilities,

    pending: Set<TileKey>,
    cache: Map<TileKey, ImageBitmap | null>,

    get: (x: number, y: number, z: number) => ImageBitmap | null
}
async function loadTile(cache: Map<TileKey, ImageBitmap | null>, pending: Set<TileKey>, capabilities: WMTSCapabilities, onLoad: ((x: number, y: number, z: number) => void) | undefined, x: number, y: number, z: number) {
    const key = tileKey(x, y, z)
    const url = capabilities.template
        .replaceAll("{Style}", capabilities.style)
        .replaceAll("{TileMatrixSet}", capabilities.matrixSet)
        .replaceAll("{TileMatrix}", String(z))
        .replaceAll("{TileRow}", String(y))
        .replaceAll("{TileCol}", String(x))

    // a 404 is permanent: remember the miss so the tile is never asked for again.
    // a thrown network error is not, so that key stays uncached for a retry.
    const trim = () => {
        while (cache.size > MAX_CACHE_SIZE) {
            const first = cache.keys().next()
            if (first.done) break;
            const image = cache.get(first.value)
            if (image != null) image.close()
            cache.delete(first.value)
        }
    }

    try {
        const response = await fetch(url)
        if (!response.ok) {
            console.log("Couldnt load tile! ", response.status)
            cache.set(key, null)
            return
        }
        const tile = await createImageBitmap(await response.blob())
        cache.set(key, tile)
        onLoad?.(x, y, z)
    } catch (error) {
        console.log("Couldnt load tile! ", error)
    } finally {
        pending.delete(key)
        trim()
    }
}
async function createCachedTileProviderFor(productId: string, onLoad?: (x: number, y: number, z: number) => void): Promise<CachedTileProvider> {
    const capabilities = await fetchWMTSCapabilities(productId)

    const width = capabilities.tileSize[0]
    const height = capabilities.tileSize[1]

    const pending = new Set<TileKey>()
    const cache = new Map<TileKey, ImageBitmap | null>()
    const limits = levelLimits(capabilities)

    return {
        width: width,
        height: height,
        maxLevel: capabilities.maxLevel,
        capabilities: capabilities,
        pending: pending,
        cache: cache,
        get: (x, y, z) => {
            // outside the area or the levels this product publishes: no request at all
            const range = limits.get(z)
            if (range === undefined) return null
            if (x < range.minCol || x > range.maxCol) return null
            if (y < range.minRow || y > range.maxRow) return null

            const key = tileKey(x, y, z)
            const hit = cache.get(key)
            if (hit !== undefined) return hit;
            if (!pending.has(key)) {
                pending.add(key)
                void loadTile(cache, pending, capabilities, onLoad, x, y, z)
            }
            return null
        }
    }
}


export type { CachedTileProvider }
export { createCachedTileProviderFor }

