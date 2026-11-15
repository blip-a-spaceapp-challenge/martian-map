import type { InteractiveMap } from "./interactive-map.ts";
import { imJumpTo, imSlide } from "./interactive-map.ts";

function applyTransform(map: InteractiveMap) {
    const px = map.view.x - map.tileProvider.width
    const py = map.view.y - map.tileProvider.height
    map.canvas.style.transform = `translate(${-px}px, ${-py}px)`
}

type MapControls = {
    // запросить уровень; (ox, oy) — точка в координатах viewport, которая остаётся на месте
    zoomTo: (level: number, ox?: number, oy?: number) => void,
    // перерисовать текущий вид (после смены слоя), сохранив смещение
    refresh: () => void,
}

// onZoomed вызывается после каждого фактического изменения уровня
function bindControls(map: InteractiveMap, viewport: HTMLDivElement, onZoomed: (level: number) => void): MapControls {
    const zoomTo = (z: number, ox = viewport.clientWidth / 2, oy = viewport.clientHeight / 2) => {
        const level = Math.max(0, Math.min(map.tileProvider.maxLevel, Math.round(z)))
        if (level === map.state.z) return

        const tw = map.tileProvider.width
        const th = map.tileProvider.height
        const k = 2 ** (level - map.state.z)

        const originX = (map.state.x * tw + (map.view.x - tw) + ox) * k - ox
        const originY = (map.state.y * th + (map.view.y - th) + oy) * k - oy

        const tx = Math.floor(originX / tw)
        const ty = Math.floor(originY / th)
        imJumpTo(map, tx, ty, level)
        imSlide(map, originX - tx * tw, originY - ty * th)

        applyTransform(map)
        onZoomed(level)
    }

    const refresh = () => {
        const vx = map.view.x - map.tileProvider.width
        const vy = map.view.y - map.tileProvider.height
        imJumpTo(map, map.state.x, map.state.y, map.state.z)
        imSlide(map, vx, vy)
        applyTransform(map)
    }

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
        applyTransform(map)
    })
    viewport.addEventListener("pointerup", (e) => {
        dragging = false
        viewport.releasePointerCapture(e.pointerId)
        viewport.classList.remove("dragging")
    })

    let lastWheel = 0
    viewport.addEventListener("wheel", (e) => {
        e.preventDefault()
        if (e.deltaY === 0) return
        const now = performance.now()
        if (now - lastWheel < 150) return
        lastWheel = now

        const rect = viewport.getBoundingClientRect()
        zoomTo(map.state.z + (e.deltaY < 0 ? 1 : -1), e.clientX - rect.left, e.clientY - rect.top)
    }, { passive: false })

    return { zoomTo, refresh }
}

export type { MapControls }
export { bindControls, applyTransform }