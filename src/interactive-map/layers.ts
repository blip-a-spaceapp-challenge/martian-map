type LayerInfo = {
    id: string,
    name: string,
    description: string,
    productId: string,   // Mars Trek product id
}

// STUB: replace with an API request later
const STUB_LAYERS: LayerInfo[] = [
    { id: "photo", name: "Imagery", description: "Viking color mosaic", productId: "Mars_Viking_MDIM21_ClrMosaic_global_232m" },
    { id: "elevation", name: "Elevation", description: "MOLA shaded relief", productId: "Mars_MGS_MOLA_ClrShade_merge_global_463m" },
]

async function fetchLayers(): Promise<LayerInfo[]> {
    return STUB_LAYERS
}

export type { LayerInfo }
export { fetchLayers }