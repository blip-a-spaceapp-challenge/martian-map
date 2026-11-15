import { Path, Region } from "../data/data.ts"
import type { State, View, InteractiveMap, TileProvider } from "./interactive-map.ts"
import { createInteractiveMap, imDrawCell, imInitLayer, imJumpTo, imSlide } from "./interactive-map.ts"
import { bindControls } from "./map-controls.ts"
import { createCachedTileProviderFor } from "./mars-trek.ts"

const ID = "Mars_Viking_MDIM21_ClrMosaic_global_232m"

type MapState = {
    map: InteractiveMap,
    resize_observer: ResizeObserver
}

var state: MapState | undefined

async function createMap() {
    const tiles = await createCachedTileProviderFor(ID, (x, y, z) => {
        console.log(`Tile ${x} ${y} ${z} loaded!`)
        if (state === undefined) return;
        const i = x - state.map.state.x
        const j = y - state.map.state.y
        if (i < 0 || j < 0) return;
        if (i >= state.map.canvas.width / state.map.tileProvider.width) return;
        if (j >= state.map.canvas.height / state.map.tileProvider.height) return;
        imDrawCell(state.map, i, j)
    })
    const view = {
        x: 0,
        y: 0,
        width: 1024,
        height: 1024
    }
    const map = createInteractiveMap(tiles, view) ?? (() => { throw new Error("cant create map") })()

    
    const viewport = document.getElementById("viewport")
    if (!(viewport instanceof HTMLDivElement)) {
        throw new Error("no #viewport")
    }
    viewport.appendChild(map.canvas)



    bindControls(map, viewport)



    const resize_observer = new ResizeObserver(() => {
        const cols = Math.ceil(map.canvas.clientWidth / map.tileProvider.width) + 2
        const rows = Math.ceil(map.canvas.clientHeight / map.tileProvider.height) + 2
        const w = cols * tiles.width
        const h = rows * tiles.height

        if (w === map.canvas.width && h === map.canvas.height) return;

        map.canvas.width = w
        map.canvas.height = h
        imJumpTo(map, map.state.x, map.state.y, map.state.z)
    })
    resize_observer.observe(viewport)


    imJumpTo(map, 0, 0, 4)


    state = {
        map: map,
        resize_observer: resize_observer
    }
}

void createMap()

