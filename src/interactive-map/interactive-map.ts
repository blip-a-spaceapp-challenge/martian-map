type MapState = {
	x: number,
	y: number,
	z: number,
};

type View = {
	x: number,
	y: number,
	w: number,
	h: number,
}

type InteractiveMap = {
	canvas: HTMLCanvasElement,
	canvasCtx: CanvasRenderingContext2D,
	state: MapState,
	view: View,

	tileProvider: TileProvider,
};

type TileProvider = {
	w: number,
	h: number,
	get: (x: number, y: number, z: number) => ImageBitmap,
}

// createMap - создает интерактивную карту.
// Используйте parent.appendChild(mapName.canvas) чтобы добавить в качестве дочернего элемента нужного вам элемента.
function createInteractiveMap(tileProvider: TileProvider, view: View): InteractiveMap | null {
	const canvas = document.createElement("canvas");
	canvas.height = view.h + tileProvider.h * 2;
	canvas.width = view.w + tileProvider.w * 2;
	
	const canvasCtx = canvas.getContext("2d");
	if (canvasCtx == null) {
		return null;
	}

	return {
		canvas,
		canvasCtx,
		state: { x: NaN, y: NaN, z: NaN },
		view,
		tileProvider,
	};
}

function initLayer(im: InteractiveMap) {
	for (let i = 0; i < im.canvas.height;) {
		for (let i = 0; i < im.canvas.width;) {

		}
	}
}
