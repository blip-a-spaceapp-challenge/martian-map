type MapState = {
	x: number,
	y: number,
	z: number,
};

type MapData = {
	tiles: ImageBitmap[],
};

type InteractiveMap = {
	canvas: HTMLCanvasElement,
	canvasCtx: CanvasRenderingContext2D,
	state: MapState,
};

// createMap - создает интерактивную карту.
// Используйте parent.appendChild(mapName.canvas) чтобы добавить в качестве дочернего элемента нужного вам элемента.
function createMap(): InteractiveMap | null {
	const canvas = document.createElement("canvas");
	const canvasCtx = canvas.getContext("2d");
	if (canvasCtx == null) {
		return null;
	}

	return {
		canvas,
		canvasCtx,
		state: {x: NaN, y: NaN, z: NaN}
	};
}
