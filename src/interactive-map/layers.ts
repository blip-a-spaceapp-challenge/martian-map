type LayerInfo = {
    id: string,
    name: string,
    description: string,
    productId: string,   // Mars Trek product id
    visible: boolean,    // shown when the map opens
    opacity: number,     // 0..1
}

// STUB: replace with an API request later.
// All three products use the same global 256px tile grid (default028mm),
// so they can be stacked at the same zoom level.
const STUB_LAYERS: LayerInfo[] = [
    {
        id: "viking",
        name: "Viking mosaic",
        description: "Global colour mosaic, 232 m/px",
        productId: "Mars_Viking_MDIM21_ClrMosaic_global_232m",
        visible: true,
        opacity: 1,
    },
    {
        id: "ctx",
        name: "CTX mosaic",
        description: "Gale Crater from Mars Reconnaissance Orbiter CTX",
        productId: "curiosity_ctx_mosaic",
        visible: true,
        opacity: 1,
    },
    {
        id: "hirise",
        name: "HiRISE mosaic",
        description: "Gale Crater high resolution imagery",
        productId: "curiosity_hirise_mosaic",
        visible: true,
        opacity: 1,
    },
]

async function fetchLayers(): Promise<LayerInfo[]> {
    return STUB_LAYERS
}

export type { LayerInfo }
export { fetchLayers }
