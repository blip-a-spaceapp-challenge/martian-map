import { Path, Region } from "../data/data.ts"
import type { State, View, InteractiveMap, TileProvider } from "./interactive-map.ts"
import { gridRows, gridCols, createInteractiveMap, imDrawCell, imInitLayer, imJumpTo, imSlide } from "./interactive-map.ts"
import { bindControls } from "./map-controls.ts"
import { createCachedTileProviderFor } from "./mars-trek.ts"

const LAYERS = [
	{ id: "Mars_Viking_MDIM21_ClrMosaic_global_232m", opacity: 1 },
];

type MapState = {
	map: InteractiveMap,
	resize_observer: ResizeObserver,
};

var state: MapState | undefined;

async function createMap() {
	const providers = await Promise.all(LAYERS.map((layer, index) =>
		createCachedTileProviderFor(layer.id, (x, y, z) => {
			console.log(`Tile ${x} ${y} ${z} loaded!`)
			if (state === undefined) return;
			const i = x - state.map.state.x
			const j = y - state.map.state.y
			if (i < 0 || j < 0 || i >= gridCols(state.map) || j >= gridRows(state.map)) return;
			imDrawCell(state.map, index, i, j)
		})));

	const viewport = document.getElementById("viewport")
	if (!(viewport instanceof HTMLDivElement)) {
		throw new Error("no #viewport")
	}

	const view = { x: 0, y: 0, width: viewport.clientWidth, height: viewport.clientHeight };
	const map = createInteractiveMap(providers, view) ?? (() => { throw new Error("cant create map") })()

	// it complains when I use for ([i, layer] of LAYERS.entries()), it complains for no reason!!
	LAYERS.map((layer, i) => map.layers[i].canvas.style.opacity = String(layer.opacity));

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


	imJumpTo(map, 0, 0, 4)


	state = {
		map: map,
		resize_observer: resize_observer
	}
}

void createMap()

