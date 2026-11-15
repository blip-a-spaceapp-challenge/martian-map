import type { InteractiveMap } from "./interactive-map.ts"
import type { CachedTileProvider } from "./mars-trek.ts"

type Pixel = {
    x: number,
    y: number
}

function matrixSize(tp: CachedTileProvider, z: number): [number, number] {
    const m = tp.capabilities.tileMatricies.find(m => m.identifier === z)
    if (m && m.matrixWidth > 0 && m.matrixHeight > 0) return [m.matrixWidth, m.matrixHeight];
    return [2 ** (z + 1), 2 ** z]
}

const wrapLon = (lon: number) => ((lon + 180) % 360 + 360) % 360 - 180

function lonLatToWorld(tp: CachedTileProvider, lon: number, lat: number, z: number): Pixel {
    const [mw, mh] = matrixSize(tp, z)
    return {
        x: (wrapLon(lon) + 180) / 360 * mw * tp.width,
        y: (90 - lat) / 180 * mh * tp.height
    }
}

function worldToLonLat(tp: CachedTileProvider, p: Pixel, z: number) {
    const [mw, mh] = matrixSize(tp, z)
    return {
        longtitude: p.x / (mw * tp.width) * 360 - 180,
        latitude: 90 - p.y / (mh * tp.height) * 180
    }
}

function lonLatToViewport(im: InteractiveMap, lon: number, lat: number): Pixel {
    const tp = im.tileProvider as CachedTileProvider
    const w = lonLatToWorld(tp, lon, lat, im.state.z)
    return {
        x: w.x - im.state.x * tp.width - (im.view.x - tp.width),
        y: w.y - im.state.y * tp.height - (im.view.y - tp.height)
    }
}

function viewportToLonLat(im: InteractiveMap, vx: number, vy: number) {
    const tp = im.tileProvider as CachedTileProvider
    return worldToLonLat(tp, {
        x: im.state.x * tp.width + (im.view.x - tp.width) + vx,
        y: im.state.y * tp.height + (im.view.y - tp.height) + vy
    }, im.state.z)
}

export { lonLatToWorld, worldToLonLat, lonLatToViewport, viewportToLonLat }

