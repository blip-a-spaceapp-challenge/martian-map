import type { InteractiveMap } from "./interactive-map.ts";
import { imJumpTo, imSlide } from "./interactive-map.ts";

function bindControls(map: InteractiveMap, viewport: HTMLDivElement) {
    let dragging = false
    let lastX = 0
    let lastY = 0
    viewport.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        dragging = true
        lastX = e.clientX
        lastY = e.clientY
        viewport.setPointerCapture(e.pointerId)
        viewport.classList.add("dragging")
    })
    viewport.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const dx = lastX - e.clientX
        const dy = lastY - e.clientY
        lastX = e.clientX
        lastY = e.clientY

        imSlide(map, dx, dy)

        const px = map.view.x - map.tileProvider.width
        const py = map.view.y - map.tileProvider.height
        map.canvas.style.transform = `translate(${-px}px, ${-py}px)`
    })
    viewport.addEventListener("pointerup", (e) => {
        dragging = false
        viewport.releasePointerCapture(e.pointerId)
        viewport.classList.remove("dragging")
    })

    viewport.addEventListener("wheel", (e) => {
        e.preventDefault()
        const z = Math.max(0, Math.min(map.tileProvider.maxLevel, map.state.z + (e.deltaY < 0 ? 1 : -1)))
        if (z === map.state.z) return;

        const gx = (map.state.x * map.tileProvider.width + (map.view.x - map.tileProvider.width) + e.offsetX) * 2 ** (z - map.state.z)
        const gy = (map.state.y * map.tileProvider.height + (map.view.y - map.tileProvider.height) + e.offsetY) * 2 ** (z - map.state.z)

        imJumpTo(map, Math.floor(gx / map.tileProvider.width), Math.floor(gy / map.tileProvider.height), z)
        map.canvas.style.transform = "translate(0, 0)"
    })
}

export { bindControls }

