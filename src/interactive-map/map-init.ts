import { loadDatasets } from "../data/data.ts"
import type { Point } from "../data/data.ts"
import type { InteractiveMap } from "./interactive-map.ts"
import { createInteractiveMap, imDrawCell, imJumpTo } from "./interactive-map.ts"
import type { MapControls } from "./map-controls.ts"
import { applyTransform, bindControls } from "./map-controls.ts"
import { createOverlay, shapesFrom } from "./map-overlay.ts"
import { lonLatToWorld } from "./map-projection.ts"
import { createCachedTileProviderFor } from "./mars-trek.ts"
import type { CachedTileProvider } from "./mars-trek.ts"
import { createZoomControl } from "./zoom-control.ts"
import { createScaleBar } from "./scale-bar.ts"
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

    // the map is created after the first provider, but the tile callback is needed earlier
    const mapRef: { current?: InteractiveMap } = {}
    let tiles: CachedTileProvider

    // tile provider for a layer; redraws cells only while it is active
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

    // Zoom slider: the callback is "user requested a level" -> map,
    // the returned functions let the map report changes back to the slider.
    // The overlay does not move with the canvas, so it is redrawn here too.
    let applyZoomLevel: (level: number) => void = () => {}
    const controls: MapControls = bindControls(created, viewport, (level) => {
        applyZoomLevel(level)
        overlay.redraw()
    })
    const zoom = createZoomControl(el("zoom"), tiles.maxLevel, (level) => controls.zoomTo(level))
    const scale = createScaleBar(el("scale"), created)
    applyZoomLevel = (level) => { zoom.setLevel(level); scale.refresh() }

    // point the map at a location: (lon, lat) ends up in the viewport centre
    const centerOn = (lon: number, lat: number, requestedZoom: number) => {
        const z = Math.max(0, Math.min(tiles.maxLevel, Math.round(requestedZoom)))
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
        applyZoomLevel(z)
    }

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
    applyZoomLevel(created.state.z)

    // Layers (different maps)
    let layerToken = 0
    let activeLayer = layers[0].id
    const setActiveLayer = createLayerPanel(el("layers"), layers, activeLayer, (id) => void switchLayer(id))

    async function switchLayer(id: string) {
        const info = layers.find(l => l.id === id)
        if (!info || id === activeLayer) return
        const token = ++layerToken
        const provider = await loadLayer(info)
        if (token !== layerToken) return      // another layer was picked while this one was loading

        // position in the new layer: if it has fewer levels, lift the tile coordinates
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
        applyZoomLevel(z)
    }

    // Regions and paths from the datasets
    const datasets = await loadDatasets()
    console.log("Datasets are loaded")
    overlay.setShapes(shapesFrom(datasets))

    // centre on landing area A instead of the world map corner
    const pts = datasets.landingA.generalArea.points
    const lon = pts.reduce((s, p) => s + p.longitude, 0) / pts.length
    const lat = pts.reduce((s, p) => s + p.latitude, 0) / pts.length
    centerOn(lon, lat, 5)

    // Missions: targets come from the datasets so the menu matches what is drawn
    const extents = new Map<string, Point[]>()

    const targetFrom = (id: string, name: string, description: string, points: Point[]): Target => {
        const lon = points.reduce((s, p) => s + p.longitude, 0) / points.length
        const lat = points.reduce((s, p) => s + p.latitude, 0) / points.length
        extents.set(id, points)
        return {
            id,
            name,
            description,
            lat: Number(lat.toFixed(5)),
            lon: Number(lon.toFixed(5)),
        }
    }

    const landingTargets: Target[] = (["A", "B", "C"] as const).map((code) => {
        const area = datasets[`landing${code}`].generalArea
        return targetFrom(`landing-${code}`, `Landing site ${code}`,
            `General area ${(area.area / 1e6).toFixed(1)} km²`, area.points)
    })

    const regionTargets: Target[] = (["A", "B", "C", "D", "E"] as const).map((code) => {
        const area = datasets[`location${code}`].generalArea
        return targetFrom(`region-${code}`, `Boxwork ${code}`,
            `Area ${(area.area / 1e6).toFixed(1)} km²`, area.points)
    })

    // highest level at which the region still takes no more than 60% of the screen
    const fitZoom = (points: Point[]): number => {
        const lons = points.map(p => p.longitude)
        const lats = points.map(p => p.latitude)
        const spanLon = Math.max(...lons) - Math.min(...lons)
        const spanLat = Math.max(...lats) - Math.min(...lats)
        const budget = Math.min(viewport.clientWidth, viewport.clientHeight) * 0.6

        let best = 0
        const matrices = [...tiles.capabilities.tileMatricies].sort((a, b) => a.identifier - b.identifier)
        for (const m of matrices) {
            const px = Math.max(
                spanLon / 360 * m.matrixWidth * tiles.width,
                spanLat / 180 * m.matrixHeight * tiles.height,
            )
            if (px > budget) break
            best = m.identifier
        }
        return best
    }

    // old examples (t1..t3) and targets from earlier runs are not duplicated
    const EXAMPLE_IDS = new Set(["t1", "t2", "t3"])
    const derivedIds = new Set([...landingTargets, ...regionTargets].map(t => t.id))

    const panelRoot = el("missions")
    const mission = await loadMission("./data/mission.json")
    mission.targets = mission.targets.filter(t => !derivedIds.has(t.id) && !EXAMPLE_IDS.has(t.id))
    mission.targets.unshift(...landingTargets, ...regionTargets)

    createMissionPanel(panelRoot, mission, () => mapCenterLonLat(created, tiles, viewport))
    // regions are small: pick a level where the target fills ~60% of the screen
    const zoomForTarget = (target: Target) => {
        const points = extents.get(target.id)
        if (points) return fitZoom(points)
        return Math.min(tiles.maxLevel, Math.max(created.state.z, 6))
    }

    panelRoot.addEventListener("target-select", (e) => {
        const target = (e as CustomEvent<Target>).detail
        centerOn(target.lon, target.lat, zoomForTarget(target))
    })
    panelRoot.addEventListener("target-add", (e) => {
        const target = (e as CustomEvent<Target>).detail
        centerOn(target.lon, target.lat, zoomForTarget(target))
    })
    panelRoot.addEventListener("target-remove", (e) => console.log("removed", (e as CustomEvent<Target>).detail))
}

void createMap()
