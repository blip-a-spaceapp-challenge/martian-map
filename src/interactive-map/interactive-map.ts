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
};

type Layer = {
	provider: TileProvider,
	canvas: HTMLCanvasElement,
	ctx: CanvasRenderingContext2D,
};

type InteractiveMap = {
	root: HTMLDivElement,
	layers: Layer[],
	// canvas: HTMLCanvasElement,
	// canvasCtx: CanvasRenderingContext2D,
	resCanvas: HTMLCanvasElement,
	resCanvasCtx: CanvasRenderingContext2D,
	state: State,
	view: View,

	tileProvider: TileProvider,

	clearDraw: boolean,
};

type TileProvider = {
	width: number,
	height: number,
	maxLevel: number,
	get: (x: number, y: number, z: number) => ImageBitmap | null,
};

function createCanvas(width: number, height: number): HTMLCanvasElement {
	const canvas = document.createElement("canvas");

	canvas.width = width;
	canvas.height = height;

	return canvas;
}

// createInteractiveMap - creates InteractiveMap.
// Use parent.appendChild(mapName.canvas) to add to DOM.
function createInteractiveMap(providers: TileProvider[], view: View, clearDraw: boolean = true): InteractiveMap | null {
	if (providers.length === 0) return null;
	const base = providers[0];
	if (providers.some(p => p.width !== base.width || p.height !== base.height)) return null;

	const w = (Math.ceil(view.width / base.width) + 2) * base.width;
	const h = (Math.ceil(view.height / base.height) + 2) * base.height

	const root = document.createElement("div");
	root.className = "im-root";

	const layers: Layer[] = [];
	for (const provider of providers) {
		const canvas = createCanvas(w, h);
		canvas.className = "im-layer";
		const ctx = canvas.getContext("2d");
		if (ctx == null) return null;
		root.appendChild(canvas);
		layers.push({ provider, canvas, ctx })
	}

	const resCanvas = createCanvas(w, h);
	const resCanvasCtx = resCanvas.getContext("2d");
	if (resCanvasCtx == null) return null;

	return {
		root,
		layers,
		resCanvas,
		resCanvasCtx,
		state: { x: NaN, y: NaN, z: NaN },
		view,
		tileProvider: base,
		clearDraw,
	};
}

const intDiv = (a: number, b: number): [number, number] => {
	const q = Math.floor(a / b);
	return [q, a - q * b];
}

const gridCols = (im: InteractiveMap): number => Math.ceil(im.layers[0].canvas.width / im.tileProvider.width);
const gridRows = (im: InteractiveMap): number => Math.ceil(im.layers[0].canvas.height / im.tileProvider.height);

function imDrawCell(im: InteractiveMap, layer: number, i: number, j: number) {
	const { provider, ctx } = im.layers[layer];
	const tile = provider.get(im.state.x + i, im.state.y + j, im.state.z);
	if (tile == null) return;

	ctx.drawImage(tile, i * im.tileProvider.width, j * im.tileProvider.height);
}

function imInitLayer(im: InteractiveMap) {
	const rows = gridRows(im);
	const cols = gridCols(im);

	for (let l = 0; l < im.layers.length; ++l) {
		for (let j = 0; j < rows; ++j) {
			for (let i = 0; i < cols; ++i) {
				imDrawCell(im, l, i, j);
			}
		}
	}
}

function imJumpTo(im: InteractiveMap, x: number, y: number, z: number, c: number = 2) {
	const s = c ** (z - im.state.z);
	const ox = (im.state.x * s - x) * im.tileProvider.width;
	const oy = (im.state.y * s - y) * im.tileProvider.height;

	if (im.clearDraw && Number.isFinite(s) && s !== 1) {
		for (const { canvas, ctx } of im.layers) {
			im.resCanvasCtx.clearRect(0, 0, im.resCanvas.width, im.resCanvas.height);
			im.resCanvasCtx.drawImage(canvas, 0, 0);

			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(im.resCanvas, ox, oy, im.resCanvas.width * s, im.resCanvas.height * s);
		}
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

	for (const { canvas, ctx } of im.layers) {
		if (im.clearDraw) ctx.globalCompositeOperation = "copy";
		ctx.drawImage(canvas, -nx * im.tileProvider.width, -ny * im.tileProvider.height);
		if (im.clearDraw) ctx.globalCompositeOperation = "source-over";
	}

	for (let j = 0; j < rows; ++j) {
		const oj = j + ny;
		const rowIsNew = oj < 0 || oj >= rows;
		for (let i = 0; i < cols; ++i) {
			const oi = i + nx;
			const colIsNew = oi < 0 || oi >= cols;
			if (rowIsNew || colIsNew) {
				for (let l = 0; l < im.layers.length; ++l) imDrawCell(im, l, i, j);
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



export type { State, View, Layer, InteractiveMap, TileProvider };
export { gridRows, gridCols, createInteractiveMap, imDrawCell, imJumpTo, imGridShift, imInitLayer, imSlide, intDiv };

