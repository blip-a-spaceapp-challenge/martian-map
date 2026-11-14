// refers to top-left tile index
type State = {
	x: number,
	y: number,
	z: number,
};

type View = {
	x: number,
	y: number,
	width: number,
	height: number,
}

type InteractiveMap = {
	canvas: HTMLCanvasElement,
	canvasCtx: CanvasRenderingContext2D,
	state: State,
	view: View,

	tileProvider: TileProvider,
};

type TileProvider = {
	width: number,
	height: number,
	get: (x: number, y: number, z: number) => ImageBitmap,
}

// createInteractiveMap - creates InteractiveMap.
// Use parent.appendChild(mapName.canvas) to add to DOM.
function createInteractiveMap(tileProvider: TileProvider, view: View): InteractiveMap | null {
	const canvas = document.createElement("canvas");

	// tile only partially inside view should still fully fit in canvas, from both sides
	canvas.height = view.height + tileProvider.height * 2;
	canvas.width = view.width + tileProvider.width * 2;

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

function imInitLayer(im: InteractiveMap) {
	let y_off = im.view.height / 2;
	let x_off = im.view.width / 2;

	for (let y = 0; y_off < im.view.height; ++y) {
		for (let x = im.state.x; x_off < im.view.width; ++x) {
			im.canvasCtx.drawImage(im.tileProvider.get(x, y, im.state.z), x_off, y_off);
			x_off += im.tileProvider.width;
		}
		y_off += im.tileProvider.height;
	}
}

const intDiv = (a: number, b: number): [number, number] => {
	const q = Math.floor(a / b);
	return [a / b, a - q * b];
}

function imSlide(im: InteractiveMap, x_off: number, y_off: number) {
	const [y_tiles_off, y_rem] = intDiv(y_off, im.tileProvider.height);
	const [x_tiles_off, x_rem] = intDiv(x_off, im.tileProvider.width);

	if (Math.abs(x_off) > im.view.width || Math.abs(y_off) > im.view.height) {
		imInitLayer(im);
	} else {
		im.canvasCtx.drawImage(im.canvas, x_off, y_off);
	}
}
