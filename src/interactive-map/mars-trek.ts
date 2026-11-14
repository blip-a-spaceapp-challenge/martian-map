import type { State, View, InteractiveMap, TileProvider } from "./interactive-map.ts"
// import {  } from "./interactive-map.ts"

const TREK_MARS_EQ = "https://trek.nasa.gov/tiles/Mars/EQ";



type WMTSCapabilities = {
    template: string,
    format: string,
    style: string,
    matrixSet: string,
    maxLevel: number,
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
        bounds: lower && upper ? [[lower.b, lower.a], [upper.b, upper.a]] : null
    };
}



type MarsTrekTileProvider = {
    width: number,
    height: number,

    capabilities: number,

    get: (x: number, y: number, z: number) => ImageBitmap | null;
}
async function createMarsTrekTileProvider(): Promise<MarsTrekTileProvider> {
    return {
        width: 0,
        height: 0,
        capabilities: 0,
        get: (_x, _y, _z) => null
    };
}



void fetchWMTSCapabilities("Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw").then(console.log, console.error);

