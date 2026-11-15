type LayerInfo = {
    id: string,
    name: string,
    description: string,
    productId: string,   // id продукта на Mars Trek
}

// ЗАГЛУШКА: потом заменить на запрос к API
const STUB_LAYERS: LayerInfo[] = [
    { id: "photo", name: "Снимки", description: "Цветная мозаика Viking", productId: "Mars_Viking_MDIM21_ClrMosaic_global_232m" },
    { id: "elevation", name: "Высоты", description: "Рельеф MOLA", productId: "Mars_MGS_MOLA_ClrShade_merge_global_463m" },
]

async function fetchLayers(): Promise<LayerInfo[]> {
    return STUB_LAYERS
}

export type { LayerInfo }
export { fetchLayers }