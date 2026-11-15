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

    let tile: ImageBitmap | null = null
    try {
        const response = await fetch(url)
        if (!response.ok) {
            console.log("Couldnt load tile! ", response.status)
            cache.set(key, null);
            return;
        } else {
            tile = await createImageBitmap(await response.blob())
            console.log("Tile loaded successfuly! ", tile)
        }
    } catch (error) {
        console.log("Couldnt load tile! ", error)
    }

    cache.set(key, tile)
    pending.delete(key)
    onLoad?.(x, y, z)
    
    while (cache.size > MAX_CACHE_SIZE) {
        const first = cache.keys().next()
        if (first.done) break;
        const image = cache.get(first.value)
        if (image !== undefined && image != null) image.close()
        cache.delete(first.value)
    }
}
async function createCachedTileProviderFor(productId: string, onLoad?: (x: number, y: number, z: number) => void): Promise<CachedTileProvider> {
    const capabilities = await fetchWMTSCapabilities(productId)

    const width = capabilities.tileSize[0]
    const height = capabilities.tileSize[1]

    const pending = new Set<TileKey>()
    const cache = new Map<TileKey, ImageBitmap | null>()

    return {
        width: width,
        height: height,
        maxLevel: capabilities.maxLevel,
        capabilities: capabilities,
        pending: pending,
        cache: cache,
        get: (x, y, z) => {
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

