import { loadDatasets } from "../data/data.ts"
import type { InteractiveMap } from "./interactive-map.ts"
import { createInteractiveMap, imDrawCell, imJumpTo } from "./interactive-map.ts"
import type { MapControls } from "./map-controls.ts"
import { applyTransform, bindControls } from "./map-controls.ts"
import { createOverlay, shapesFrom } from "./map-overlay.ts"
import { lonLatToWorld } from "./map-projection.ts"
import { createCachedTileProviderFor } from "./mars-trek.ts"
import type { CachedTileProvider } from "./mars-trek.ts"
import { createZoomControl } from "./zoom-control.ts"
import { fetchLayers } from "./layers.ts"
import type { LayerInfo } from "./layers.ts"
import { createLayerPanel } from "./layer-panel.ts"
import { loadMission, createMissionPanel } from "./mission-panel.ts"
import type { Target } from "./mission-panel.ts"

function mapCenterLonLat(map: InteractiveMap, tiles: CachedTileProvider, viewport: HTMLElement) {
    const { x, y, z } = map.state
    const m = tiles.capabilities.tileMatricies.find(m => m.identifier === z)
    if (!m) return { lat: 0, lon: 0 }

    const px = x * tiles.width + (map.view.x - tiles.width) + viewport.clientWidth / 2
    const py = y * tiles.height + (map.view.y - tiles.height) + viewport.clientHeight / 2

    const lon = (px / (m.matrixWidth * tiles.width)) * 360 - 180
    const lat = 90 - (py / (m.matrixHeight * tiles.height)) * 180
    return { lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)) }
}

function el(id: string): HTMLElement {
    const node = document.getElementById(id)
    if (!node) throw new Error(`no #${id}`)
    return node
}

async function createMap() {
    const viewport = el("viewport") as HTMLDivElement
    const layers = await fetchLayers()
    if (layers.length === 0) throw new Error("no layers")

    // карта создаётся после первого провайдера, а колбэк тайлов нужен раньше
    const mapRef: { current?: InteractiveMap } = {}
    let tiles: CachedTileProvider

    // провайдер тайлов для слоя; перерисовывает ячейки только пока он активен
    async function loadLayer(info: LayerInfo): Promise<CachedTileProvider> {
        const provider: CachedTileProvider = await createCachedTileProviderFor(info.productId, (x, y, z) => {
            const map = mapRef.current
            if (!map || map.tileProvider !== provider) return
            if (z !== map.state.z) return
            const i = x - map.state.x
            const j = y - map.state.y
            if (i < 0 || j < 0) return
            if (i >= map.canvas.width / provider.width) return
            if (j >= map.canvas.height / provider.height) return
            imDrawCell(map, i, j)
        })
        return provider
    }

    tiles = await loadLayer(layers[0])
    const view = { x: 0, y: 0, width: 1024, height: 1024 }
    const created = createInteractiveMap(tiles, view) ?? (() => { throw new Error("cant create map") })()
    mapRef.current = created
    created.canvas.className = "map-canvas"
    viewport.appendChild(created.canvas)

    const overlay = createOverlay(created, viewport)

    // Слайдер масштаба: колбэк «пользователь запросил уровень» -> карта,
    // возвращённые функции -> карта сообщает слайдеру об изменениях.
    // Оверлей не двигается вместе с канвасом, поэтому перерисовывается здесь же.
    let applyZoomLevel: (level: number) => void = () => {}
    const controls: MapControls = bindControls(created, viewport, (level) => {
        applyZoomLevel(level)
        overlay.redraw()
    })
    const zoom = createZoomControl(el("zoom"), tiles.maxLevel, (level) => controls.zoomTo(level))
    applyZoomLevel = (level) => zoom.setLevel(level)

    const resize_observer = new ResizeObserver(() => {
        overlay.resize()

        created.view.width = viewport.clientWidth
        created.view.height = viewport.clientHeight

        const cols = Math.ceil(created.view.width / created.tileProvider.width) + 2
        const rows = Math.ceil(created.view.height / created.tileProvider.height) + 2
        const w = cols * created.tileProvider.width
        const h = rows * created.tileProvider.height
        if (w === created.canvas.width && h === created.canvas.height) return

        created.canvas.width = w
        created.canvas.height = h
        created.resCanvas.width = w
        created.resCanvas.height = h
        controls.refresh()
    })
    resize_observer.observe(viewport)

    imJumpTo(created, 0, 0, Math.min(4, tiles.maxLevel))
    zoom.setLevel(created.state.z)

    // Слои (разные карты)
    let layerToken = 0
    let activeLayer = layers[0].id
    const setActiveLayer = createLayerPanel(el("layers"), layers, activeLayer, (id) => void switchLayer(id))

    async function switchLayer(id: string) {
        const info = layers.find(l => l.id === id)
        if (!info || id === activeLayer) return
        const token = ++layerToken
        const provider = await loadLayer(info)
        if (token !== layerToken) return      // пока грузили, выбрали другой слой

        // позиция в новом слое: если уровней меньше, поднимаем координаты тайла
        const z = Math.min(created.state.z, provider.maxLevel)
        const shift = 2 ** (created.state.z - z)
        const x = Math.floor(created.state.x / shift)
        const y = Math.floor(created.state.y / shift)

        tiles = provider
        created.tileProvider = provider
        created.state.x = x
        created.state.y = y
        created.state.z = z
        controls.refresh()

        activeLayer = id
        setActiveLayer(id)
        zoom.setMaxLevel(provider.maxLevel)
        zoom.setLevel(z)
    }

    // Области и маршруты из датасетов
    const datasets = await loadDatasets()
    console.log("Datasets are loaded")
    overlay.setShapes(shapesFrom(datasets))

    // центрируемся на общей области посадки A, а не на углу карты мира
    const pts = datasets.landingA.generalArea.points
    const lon = pts.reduce((s, p) => s + p.longitude, 0) / pts.length
    const lat = pts.reduce((s, p) => s + p.latitude, 0) / pts.length
    const z = Math.min(5, tiles.maxLevel)
    const c = lonLatToWorld(tiles, lon, lat, z)
    const gx = c.x - viewport.clientWidth / 2
    const gy = c.y - viewport.clientHeight / 2
    const tx = Math.floor(gx / tiles.width)
    const ty = Math.floor(gy / tiles.height)
    imJumpTo(created, tx, ty, z)
    created.view.x = tiles.width + Math.round(gx - tx * tiles.width)
    created.view.y = tiles.height + Math.round(gy - ty * tiles.height)
    applyTransform(created)
    overlay.redraw()
    zoom.setLevel(z)

    // Миссии
    const panelRoot = el("missions")
    const mission = await loadMission("./data/mission.json")
    createMissionPanel(panelRoot, mission, () => mapCenterLonLat(created, tiles, viewport))
    panelRoot.addEventListener("target-select", (e) => console.log("selected", (e as CustomEvent<Target>).detail))
    panelRoot.addEventListener("target-add", (e) => console.log("added", (e as CustomEvent<Target>).detail))
    panelRoot.addEventListener("target-remove", (e) => console.log("removed", (e as CustomEvent<Target>).detail))
}

void createMap()
