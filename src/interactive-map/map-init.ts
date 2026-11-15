import { loadDatasets, Path, Region } from "../data/data.ts"
import type { State, View, InteractiveMap, TileProvider } from "./interactive-map.ts"
import { createInteractiveMap, imDrawCell, imInitLayer, imJumpTo, imSlide } from "./interactive-map.ts"
import { applyTransform, bindControls } from "./map-controls.ts"
import { createOverlay, shapesFrom } from "./map-overlay.ts"
import { lonLatToWorld } from "./map-projection.ts"
import { createCachedTileProviderFor } from "./mars-trek.ts"

const ID = "curiosity_hirise_mosaic"

type MapState = {
    map: InteractiveMap,
    resize_observer: ResizeObserver
}

var state: MapState | undefined

async function createMap() {
    const tiles = await createCachedTileProviderFor(ID, (x, y, z) => {
        console.log(`Tile ${x} ${y} ${z} loaded!`)
        if (state === undefined) return;
        if (z !== state.map.state.z) return
        const i = x - state.map.state.x
        const j = y - state.map.state.y
        if (i < 0 || j < 0) return;
        if (i >= state.map.canvas.width / state.map.tileProvider.width) return;
        if (j >= state.map.canvas.height / state.map.tileProvider.height) return;
        imDrawCell(state.map, i, j)
    })

    const viewport = document.getElementById("viewport")
    if (!(viewport instanceof HTMLDivElement)) throw new Error("no #viewport");

    const view = {
        x: 0,
        y: 0,
        width: 1024,
        height: 1024
    }
    const map = createInteractiveMap(tiles, view) ?? (() => { throw new Error("cant create map") })()


    map.canvas.classList.add("map-canvas")
    viewport.appendChild(map.canvas)



    const overlay = createOverlay(map, viewport)
    bindControls(map, viewport, overlay.redraw)



    const resize_observer = new ResizeObserver(() => {
        overlay.resize()

        map.view.width = viewport.clientWidth
        map.view.height = viewport.clientHeight

        const w = (Math.ceil(map.view.width / map.tileProvider.width) + 2) * map.tileProvider.width
        const h = (Math.ceil(map.view.height / map.tileProvider.height) + 2) * map.tileProvider.height

        if (w === map.canvas.width && h === map.canvas.height) return;

        map.canvas.width = map.resCanvas.width = w
        map.canvas.height = map.resCanvas.height = h
        imInitLayer(map)
    })
    resize_observer.observe(viewport)

    state = {
        map: map,
        resize_observer: resize_observer
    }

    const datasets = await loadDatasets()
    console.log("Datasets are loaded")
    overlay.setShapes(shapesFrom(datasets))

    // start centered on landing A instead of the world's top-left corner
    const pts = datasets.landingA.generalArea.points
    const lon = pts.reduce((s, p) => s + p.longitude, 0) / pts.length
    const lat = pts.reduce((s, p) => s + p.latitude, 0) / pts.length
    const z = 5
    const c = lonLatToWorld(tiles, lon, lat, z)
    const gx = c.x - viewport.clientWidth / 2
    const gy = c.y - viewport.clientHeight / 2
    const tx = Math.floor(gx / tiles.width)
    const ty = Math.floor(gy / tiles.height)
    imJumpTo(map, tx, ty, z)
    map.view.x = tiles.width + Math.round(gx - tx * tiles.width)
    map.view.y = tiles.height + Math.round(gy - ty * tiles.height)
    applyTransform(map)
    overlay.redraw()
}

void createMap()

