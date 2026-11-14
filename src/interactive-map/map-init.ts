import type { State, View, InteractiveMap, TileProvider } from "./interactive-map.ts"
import { createInteractiveMap, imDrawCell, imInitLayer, imJumpTo } from "./interactive-map.ts"
import { createCachedTileProviderFor } from "./mars-trek.ts"

async function createMap() {
    let map: InteractiveMap | undefined

    const ID = "Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw"
    const tiles = await createCachedTileProviderFor(ID, (x, y, z) => {
        console.log(`Tile ${x} ${y} ${z} loaded!`)
        if (map === undefined) return;
        const i = x - map.state.x
        const j = y - map.state.y
        if (i < 0 || j < 0) return;
        if (i >= map.canvas.width / map.tileProvider.width) return;
        if (j >= map.canvas.height / map.tileProvider.height) return;
        imDrawCell(map, i, j)
    })
    const view = {
        x: 0,
        y: 0,
        width: 1024,
        height: 1024
    }
    map = createInteractiveMap(tiles, view) ?? (() => { throw new Error("cant create map") })()

    const viewport = document.getElementById("viewport")
    if (!(viewport instanceof HTMLDivElement)) {
        throw new Error("no #viewport")
    }
    viewport.appendChild(map.canvas)

    imJumpTo(map, 0, 0, 4)
    imInitLayer(map)
}

void createMap()

