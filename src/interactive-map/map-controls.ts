// Merged: HEAD (overlay redraw hook, rAF-batched drag) + anton.ui (zoom API, slider, layers)
import type { InteractiveMap } from "./interactive-map.ts"
import { imJumpTo, imSlide } from "./interactive-map.ts"

function applyTransform(map: InteractiveMap) {
    const px = map.view.x - map.tileProvider.width
    const py = map.view.y - map.tileProvider.height
    map.canvas.style.transform = `translate3d(${-px}px, ${-py}px, 0)`
}

type MapControls = {
    // запросить уровень; (ox, oy) — точка в координатах viewport, которая остаётся на месте
    zoomTo: (level: number, ox?: number, oy?: number) => void,
    // перерисовать текущий вид (после смены слоя или размера), сохранив смещение
    refresh: () => void,
}

// onViewChange вызывается после любого изменения вида: панорама, зум, refresh.
// Аргумент — текущий уровень зума.
function bindControls(
    map: InteractiveMap,
    viewport: HTMLDivElement,
    onViewChange: (level: number) => void,
): MapControls {
    let dragging = false
    let lastX = 0
    let lastY = 0
    let pendingDx = 0
    let pendingDy = 0
    let raf = 0

    const flush = () => {
        raf = 0
        if (pendingDx === 0 && pendingDy === 0) return
        imSlide(map, pendingDx, pendingDy)
        pendingDx = 0
        pendingDy = 0
        applyTransform(map)
        onViewChange(map.state.z)
    }

    const zoomTo = (z: number, ox = viewport.clientWidth / 2, oy = viewport.clientHeight / 2) => {
        if (!Number.isFinite(map.state.z)) return

        const level = Math.max(0, Math.min(map.tileProvider.maxLevel, Math.round(z)))
        if (level === map.state.z) return

        // не терять сдвиг, накопленный до зума
        if (raf) {
            cancelAnimationFrame(raf)
            flush()
        }

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
        onViewChange(level)
    }

    const refresh = () => {
        if (!Number.isFinite(map.state.z)) return

        const vx = map.view.x - map.tileProvider.width
        const vy = map.view.y - map.tileProvider.height

        imJumpTo(map, map.state.x, map.state.y, map.state.z)
        imSlide(map, vx, vy)

        applyTransform(map)
        onViewChange(map.state.z)
    }

    const endDrag = (e: PointerEvent) => {
        if (!dragging) return
        dragging = false
        if (raf) {
            cancelAnimationFrame(raf)
            flush()
        }
        if (viewport.hasPointerCapture(e.pointerId)) {
            viewport.releasePointerCapture(e.pointerId)
        }
        viewport.classList.remove("dragging")
    }

    viewport.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return
        dragging = true
        lastX = e.clientX
        lastY = e.clientY
        viewport.setPointerCapture(e.pointerId)
        viewport.classList.add("dragging")
    })

    viewport.addEventListener("pointermove", (e) => {
        if (!dragging) return
        pendingDx += lastX - e.clientX
        pendingDy += lastY - e.clientY
        lastX = e.clientX
        lastY = e.clientY
        if (!raf) raf = requestAnimationFrame(flush)
    })

    viewport.addEventListener("pointerup", endDrag)
    viewport.addEventListener("pointercancel", endDrag)
    viewport.addEventListener("lostpointercapture", endDrag)

    let lastWheel = 0
    viewport.addEventListener("wheel", (e) => {
        e.preventDefault()
        if (e.deltaY === 0) return
        // схлопываем серию событий трекпада, но не больше ~3 кадров
        const now = performance.now()
        if (now - lastWheel < 50) return
        lastWheel = now

        const rect = viewport.getBoundingClientRect()
        zoomTo(map.state.z + (e.deltaY < 0 ? 1 : -1), e.clientX - rect.left, e.clientY - rect.top)
    }, { passive: false })

    return { zoomTo, refresh }
}

export type { MapControls }
export { bindControls, applyTransform }
