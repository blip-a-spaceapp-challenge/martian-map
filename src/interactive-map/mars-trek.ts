// import type { State, View, InteractiveMap, TileProvider } from "./interactive-map.ts"
// import {  } from "./interactive-map.ts"

const TREK_MARS_EQ = "https://trek.nasa.gov/tiles/Mars/EQ"
const MAX_CACHE_SIZE = 512


type WMTSCapabilities = {
    template: string,
    format: string,
    style: string,
    matrixSet: string,
    maxLevel: number,
    tile_size: [number, number],
    bounds: [number[], number[]] | null
}
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

    const tile_sizes = [...xml.getElementsByTagName("TileMatrix")]
        .map(matrix => [Number(firstText(matrix, "TileWidth")), Number(firstText(matrix, "TileHeight"))]);
    const tile_size = tile_sizes[0];
    for (const tsize of tile_sizes) {
        if (tsize[0] !== tile_size[0] || tsize[1] !== tile_size[1]) {
            throw new Error('Supported only WMTS services with uniform tile dimensions!');
        }
    } 

    const levels = [...xml.getElementsByTagName("TileMatrix")]
        .map(matrix => Number(firstText(matrix, "Identifier")))
        .filter(level => Number.isFinite(level));

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
        maxLevel: levels.length ? Math.max(...levels) : 7,
        tile_size: [tile_size[0], tile_size[1]],
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
        cache.delete(first.value)
    }
}
async function createCachedTileProviderFor(productId: string, onLoad?: (x: number, y: number, z: number) => void): Promise<CachedTileProvider> {
    const capabilities = await fetchWMTSCapabilities(productId)

    const width = capabilities.tile_size[0]
    const height = capabilities.tile_size[1]

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

