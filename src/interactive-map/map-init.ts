import { Path, Region } from "../data/data.ts"
import type { State, View, InteractiveMap, TileProvider } from "./interactive-map.ts"
import { gridRows, gridCols, createInteractiveMap, imDrawCell, imOnTileLoaded, imInitLayer, imJumpTo, imSlide } from "./interactive-map.ts"
import { bindControls } from "./map-controls.ts"
import { createCachedTileProviderFor } from "./mars-trek.ts"

const LAYERS = [
	{ id: "Mars_Viking_MDIM21_ClrMosaic_global_232m", opacity: 1 },
	{ id: "Mars_MGS_MOLA_ClrShade_merge_global_463m", opacity: 0.3 },
	{ id: "curiosity_ctx_mosaic", opacity: 0.4 },
	{ id: "curiosity_hirise_mosaic", opacity: 0.8 },
];

type MapState = {
	map: InteractiveMap,
	resize_observer: ResizeObserver,
};

var state: MapState | undefined;

async function createMap() {
	const providers = await Promise.all(LAYERS.map((layer, index) =>
		createCachedTileProviderFor(layer.id, (x, y, z) => {
			console.log(`Tile ${x} ${y} ${z} loaded!`);
			if (state !== undefined) imOnTileLoaded(state.map, index, x, y, z);
		})));

	const viewport = document.getElementById("viewport")
	if (!(viewport instanceof HTMLDivElement)) {
		throw new Error("no #viewport")
	}

	const view = { x: 0, y: 0, width: viewport.clientWidth, height: viewport.clientHeight };
	const map = createInteractiveMap(providers, view) ?? (() => { throw new Error("cant create map") })()

	for (const [i, layer] of LAYERS.entries()) {
		map.layers[i].canvas.style.opacity = String(layer.opacity);
	}

	viewport.appendChild(map.root)

	bindControls(map, viewport)

	const resize_observer = new ResizeObserver(() => {
		map.view.width = viewport.clientWidth
		map.view.height = viewport.clientHeight

		const w = (Math.ceil(map.view.width / map.tileProvider.width) + 2) * map.tileProvider.width
		const h = (Math.ceil(map.view.height / map.tileProvider.height) + 2) * map.tileProvider.height

		if (w === map.resCanvas.width && h === map.resCanvas.height) return;

		for (const { canvas } of map.layers) {
			canvas.width = w;
			canvas.height = h;
		}
		map.resCanvas.width = w;
		map.resCanvas.height = h;
		imInitLayer(map)
	})
	resize_observer.observe(viewport)

	state = {
		map: map,
		resize_observer: resize_observer
	}
	imJumpTo(map, 0, 0, 4)
}

void createMap()

