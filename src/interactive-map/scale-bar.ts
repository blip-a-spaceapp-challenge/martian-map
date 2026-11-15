import type { InteractiveMap } from "./interactive-map.ts"
import type { CachedTileProvider } from "./mars-trek.ts"
import { metersPerPixel } from "./map-projection.ts"

type ScaleBar = {
    refresh: () => void,
}

// the bar may not get wider than this, in CSS pixels
const MAX_BAR_PX = 160

// round distances a scale bar is allowed to show, in metres, longest first
const STEPS = [
    1e7, 5e6, 2e6, 1e6, 5e5, 2e5, 1e5, 5e4, 2e4, 1e4,
    5e3, 2e3, 1e3, 5e2, 2e2, 1e2, 50, 20, 10, 5, 2, 1,
]

function formatDistance(meters: number): string {
    if (meters < 1000) return `${Math.round(meters)} m`;
    const km = meters / 1000
    return `${km >= 10 ? Math.round(km) : km.toFixed(1)} km`
}

// A scale bar for the legend: the bar is a round distance and the label says which one.
// The projection is equirectangular, so the value is exact at the equator and
// slightly optimistic away from it (missing cos(lat), about 0.3% at Gale Crater).
function createScaleBar(root: HTMLElement, map: InteractiveMap): ScaleBar {
    const label = document.createElement("span")
    label.className = "sb-label"
    const bar = document.createElement("div")
    bar.className = "sb-bar"
    root.replaceChildren(label, bar)

    let rendered = ""

    const refresh = () => {
        const tp = map.tileProvider as CachedTileProvider
        const mpp = metersPerPixel(tp, map.state.z)
        if (!Number.isFinite(mpp) || mpp <= 0) return;

        // longest round distance that still fits under MAX_BAR_PX
        const meters = STEPS.find(step => step / mpp <= MAX_BAR_PX) ?? STEPS[STEPS.length - 1]
        const width = Math.max(20, Math.round(meters / mpp))
        const text = formatDistance(meters)

        // refresh also runs on pan, where nothing changes
        const next = `${width}|${text}`
        if (next === rendered) return;
        rendered = next

        bar.style.width = `${width}px`
        label.textContent = text
    }

    return { refresh }
}

export type { ScaleBar }
export { createScaleBar }
