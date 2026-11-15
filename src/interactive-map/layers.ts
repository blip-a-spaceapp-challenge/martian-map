type LayerInfo = {
    id: string,
    name: string,
    description: string,
    productId: string,   // Mars Trek product id
    visible: boolean,    // shown when the map opens
    opacity: number,     // 0..1
    hint?: string,       // small note under the name, e.g. a zoom limit
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

    // Global thematic products. They are coarse (level 1-2, about 10 km per
    // pixel) and some have no transparency, so they start hidden and half
    // transparent: turning one on blends over the imagery instead of hiding it.
    {
        id: "mola-roughness",
        name: "MOLA roughness",
        description: "Surface roughness from MOLA",
        productId: "mola_roughness",
        visible: false,
        opacity: 0.7,
        hint: "only at zoom 1 and below",
    },
    {
        id: "tes-dust",
        name: "TES dust",
        description: "Dust cover index from TES",
        productId: "TES_Dust",
        visible: false,
        opacity: 0.7,
        hint: "only at zoom 1 and below",
    },
    {
        id: "tes-ruff-dust",
        name: "TES Ruff dust",
        description: "Dust cover index after Ruff and Christensen",
        productId: "tes_ruffdust",
        visible: false,
        opacity: 0.7,
        hint: "only at zoom 2 and below",
    },
    {
        id: "tes-clinopyroxene",
        name: "TES clinopyroxene",
        description: "Clinopyroxene abundance from TES",
        productId: "TES_Clinopyroxene",
        visible: false,
        opacity: 0.7,
        hint: "only at zoom 1 and below",
    },
    {
        id: "tes-plagioclase",
        name: "TES plagioclase",
        description: "Plagioclase abundance from TES",
        productId: "TES_Plagioclase",
        visible: false,
        opacity: 0.7,
        hint: "only at zoom 1 and below",
    },
    {
        id: "tes-glass-clay",
        name: "TES glass and clay",
        description: "Glass and clay minerals from TES",
        productId: "TES_Glass_Clay",
        visible: false,
        opacity: 0.7,
        hint: "only at zoom 1 and below",
    },
    {
        id: "tes-thermal-inertia",
        name: "TES thermal inertia",
        description: "Thermal inertia from TES",
        productId: "TES_Thermal_Inertia",
        visible: false,
        opacity: 0.7,
        hint: "only at zoom 1 and below",
    },
]

async function fetchLayers(): Promise<LayerInfo[]> {
    return STUB_LAYERS
}

export type { LayerInfo }
export { fetchLayers }
