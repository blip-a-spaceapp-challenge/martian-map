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
	resCanvas: HTMLCanvasElement,
	resCanvasCtx: CanvasRenderingContext2D,
	state: State,
	view: View,

	tileProvider: TileProvider,

	clearDraw: boolean,
    scale: number
};

type TileProvider = {
	width: number,
	height: number,
	maxLevel: number,
	get: (x: number, y: number, z: number) => ImageBitmap | null,
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
	const canvas = document.createElement("canvas");

	canvas.width = width;
	canvas.height = height;

	return canvas;
}

// createInteractiveMap - creates InteractiveMap.
// Use parent.appendChild(mapName.canvas) to add to DOM.
function createInteractiveMap(tileProvider: TileProvider, view: View, clearDraw: boolean = true): InteractiveMap | null {
	// tile only partially inside view should still fully fit in canvas, from both sides
	const canvas = createCanvas(
		(Math.ceil(view.width / tileProvider.width) + 2) * tileProvider.width,
		(Math.ceil(view.height / tileProvider.height) + 2) * tileProvider.height);
	const resCanvas = createCanvas(canvas.width, canvas.height);

	const canvasCtx = canvas.getContext("2d");
	const resCanvasCtx = resCanvas.getContext("2d");
	if (canvasCtx == null || resCanvasCtx == null) {
		return null;
	}

	return {
		canvas,
		canvasCtx,
		resCanvas,
		resCanvasCtx,
		state: { x: NaN, y: NaN, z: NaN },
		view,
		tileProvider,
		clearDraw,
        scale: 1,
	};
}

const intDiv = (a: number, b: number): [number, number] => {
	const q = Math.floor(a / b);
	return [q, a - q * b];
}

const gridCols = (im: InteractiveMap): number => Math.ceil(im.canvas.width / im.tileProvider.width);
const gridRows = (im: InteractiveMap): number => Math.ceil(im.canvas.height / im.tileProvider.height);

function imDrawCell(im: InteractiveMap, i: number, j: number) {
	const tile = im.tileProvider.get(im.state.x + i, im.state.y + j, im.state.z);
	if (tile == null) return;

	im.canvasCtx.drawImage(
		tile,
		i * im.tileProvider.width,
		j * im.tileProvider.height,
	);
}

function imInitLayer(im: InteractiveMap) {
	const rows = gridRows(im);
	const cols = gridCols(im);

	for (let j = 0; j < rows; ++j) {
		for (let i = 0; i < cols; ++i) {
			imDrawCell(im, i, j);
		}
	}
}

function imJumpTo(im: InteractiveMap, x: number, y: number, z: number, c: number = 2) {
	const s = c ** (z - im.state.z);
	const ox = (im.state.x * s - x) * im.tileProvider.width;
	const oy = (im.state.y * s - y) * im.tileProvider.height;

	if (im.clearDraw && Number.isFinite(s) && s !== 1) {
		im.resCanvasCtx.clearRect(0, 0, im.resCanvas.width, im.resCanvas.height);
		im.resCanvasCtx.drawImage(im.canvas, 0, 0);

		im.canvasCtx.clearRect(0, 0, im.canvas.width, im.canvas.height);
		im.canvasCtx.drawImage(im.resCanvas, ox, oy, im.resCanvas.width * s, im.resCanvas.height * s);
	}
	im.state.x = x;
	im.state.y = y;
	im.state.z = z;
	im.view.x = im.tileProvider.width;
	im.view.y = im.tileProvider.height;

	imInitLayer(im);
}

function imGridShift(im: InteractiveMap, nx: number, ny: number) {
	if (nx === 0 && ny === 0) return;

	const rows = gridRows(im);
	const cols = gridCols(im);

	im.state.x += nx;
	im.state.y += ny;

	if (Math.abs(nx) >= cols || Math.abs(ny) >= rows) {
		imInitLayer(im);
		return;
	}

	if (im.clearDraw) im.canvasCtx.globalCompositeOperation = "copy";
	im.canvasCtx.drawImage(im.canvas, -nx * im.tileProvider.width, -ny * im.tileProvider.height);
	if (im.clearDraw) im.canvasCtx.globalCompositeOperation = "source-over";

	for (let j = 0; j < rows; ++j) {
		const oj = j + ny;
		const rowIsNew = oj < 0 || oj >= rows;
		for (let i = 0; i < cols; ++i) {
			const oi = i + nx;
			const colIsNew = oi < 0 || oi >= cols;
			if (rowIsNew || colIsNew) {
				imDrawCell(im, i, j);
			}
		}
	}
}

function imSlide(im: InteractiveMap, dx: number, dy: number) {
	im.view.x += dx;
	im.view.y += dy;

	const [nx] = intDiv(im.view.x - im.tileProvider.width, im.tileProvider.width);
	const [ny] = intDiv(im.view.y - im.tileProvider.height, im.tileProvider.height);

	im.view.x -= nx * im.tileProvider.width;
	im.view.y -= ny * im.tileProvider.height;

	imGridShift(im, nx, ny);
}



export type { State, View, InteractiveMap, TileProvider };
export { createInteractiveMap, imDrawCell, imJumpTo, imGridShift, imInitLayer, imSlide, intDiv };

