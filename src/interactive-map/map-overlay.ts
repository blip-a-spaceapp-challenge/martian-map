import { Point, Datasets } from "../data/data.ts"
import { InteractiveMap } from "./interactive-map.ts"
import { lonLatToViewport } from "./map-projection.ts"

type Shape = {
    points: Point[],
    closed: boolean,
    color: string,
    width: number,
    fill?: string,
    dash?: number[]
}

function shapesFrom(d: Datasets): Shape[] {
    const shapes: Shape[] = []
    for (const loc of [d.locationA, d.locationB, d.locationC, d.locationD, d.locationE]) {
        shapes.push({
            points: loc.generalArea.points,
            closed: true,
            color: "#4af",
            width: 2,
            fill: "rgba(74, 170, 255, 0.15)"
        })
        for (const poi of loc.pointsOfInterest) {
            shapes.push({
                points: poi.points,
                closed: true,
                color: "#fde047",
                width: 2,
                dash: [6, 4],
                fill: "rgba(253, 224, 71, 0.18)"
            })
        }
    }
    for (const land of [d.landingA, d.landingB, d.landingC]) {
        shapes.push({
            points: land.generalArea.points,
            closed: true,
            color: "#b266ff",
            width: 1.5,
            fill: "rgba(178, 102, 255, 0.15)"
        })
        for (const paths of land.pathsToLocations.values()) {
            for (const p of paths) {
                shapes.push({
                    points: p.points,
                    closed: false,
                    color: "#f66",
                    width: 2,
                    dash: [6, 4]
                })
            }
        }
    }
    return shapes
}

function createOverlay(map: InteractiveMap, viewport: HTMLDivElement) {
    const canvas = document.createElement("canvas")
    canvas.className = "overlay-canvas"
    viewport.appendChild(canvas)

    const ctx = canvas.getContext("2d")
    if (ctx == null) throw new Error("cant create overlay");

    let shapes: Shape[] = []
    const redraw = () => {
        ctx.clearRect(0, 0, viewport.clientWidth, viewport.clientHeight)
        for (const s of shapes) {
            ctx.beginPath()
            s.points.forEach((p, i) => {
                const { x, y } = lonLatToViewport(map, p.longitude, p.latitude)
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            })
            if (s.closed) ctx.closePath()
            if (s.fill !== undefined) {
                ctx.fillStyle = s.fill
                ctx.fill()
            }
            ctx.setLineDash(s.dash ?? [])
            ctx.strokeStyle = s.color
            ctx.lineWidth = s.width
            ctx.stroke()
        }
    }

    const resize = () => {
        const dpr = window.devicePixelRatio
        const w = viewport.clientWidth
        const h = viewport.clientHeight
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
        canvas.style.width = w + "px"
        canvas.style.height = h + "px"
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        redraw()
    }

    const setShapes = (s: Shape[]) => {
        shapes = s
        redraw()
    }

    return {
        resize,
        redraw,
        setShapes
    }
}

export { createOverlay, shapesFrom }

