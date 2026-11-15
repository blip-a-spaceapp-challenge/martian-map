type Target = {
    id: string,
    name: string,
    description?: string,
    lat: number,
    lon: number,
}

type Mission = {
    name: string,
    targets: Target[],
}

type MissionPanel = {
    root: HTMLElement,
    mission: Mission,
    selectedId: string | null,
    getCenter: () => { lat: number, lon: number },

    title: HTMLElement,
    count: HTMLElement,
    list: HTMLUListElement,
    input: HTMLInputElement,
    dragId: string | null

    expanded: Set<string>
}
declare global {
    interface Window {
        missionStore?: {
            load(): Promise<Mission>,
            save(mission: Mission): Promise<void>,
        }
    }
}

async function loadMission(fallbackUrl: string): Promise<Mission> {
    if (window.missionStore) return await window.missionStore.load()

    const response = await fetch(fallbackUrl)
    if (!response.ok) throw new Error(`Cant load mission "${fallbackUrl}" (HTTP ${response.status})`)
    return await response.json() as Mission
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
}

function emit(p: MissionPanel, name: "target-select" | "target-add" | "target-remove", target: Target) {
    p.root.dispatchEvent(new CustomEvent<Target>(name, { detail: target }))
}

// The panel is anchored by its right edge, so the grip sits at the bottom-left:
// dragging left widens it and dragging down grows it, both in the pointer's direction.
function bindResizeGrip(root: HTMLElement, grip: HTMLElement) {
    grip.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return
        e.preventDefault()

        const cs = getComputedStyle(root)
        const minW = parseFloat(cs.minWidth) || 200
        const minH = parseFloat(cs.minHeight) || 120
        const maxW = parseFloat(cs.maxWidth) || window.innerWidth
        const maxH = parseFloat(cs.maxHeight) || window.innerHeight

        const rect = root.getBoundingClientRect()
        const startX = e.clientX
        const startY = e.clientY
        const startW = rect.width
        const startH = rect.height

        grip.setPointerCapture(e.pointerId)

        const onMove = (ev: PointerEvent) => {
            const w = Math.min(maxW, Math.max(minW, startW + (startX - ev.clientX)))
            const h = Math.min(maxH, Math.max(minH, startH + (ev.clientY - startY)))
            root.style.width = `${Math.round(w)}px`
            root.style.height = `${Math.round(h)}px`
        }

        const onUp = (ev: PointerEvent) => {
            grip.removeEventListener("pointermove", onMove)
            grip.removeEventListener("pointerup", onUp)
            grip.removeEventListener("pointercancel", onUp)
            if (grip.hasPointerCapture(ev.pointerId)) grip.releasePointerCapture(ev.pointerId)
        }

        grip.addEventListener("pointermove", onMove)
        grip.addEventListener("pointerup", onUp)
        grip.addEventListener("pointercancel", onUp)
    })
}

function createMissionPanel(root: HTMLElement, mission: Mission, getCenter: () => { lat: number, lon: number }): MissionPanel {
    const header = el("div", "mp-header")
    const title = el("h2", "mp-title")
    const count = el("span", "mp-count")
    header.append(title, count)

    const list = el("ul", "mp-list")

    const form = el("form", "mp-form")
    const input = el("input", "mp-input")
    input.type = "text"
    input.placeholder = "Name lat lon  (no coordinates — map centre)"
    const addButton = el("button", "mp-add", "+")
    addButton.type = "submit"
    form.append(input, addButton)

    root.replaceChildren(header, list, form)

    const grip = el("div", "mp-grip")
    grip.title = "Resize"
    root.append(grip)
    bindResizeGrip(root, grip)

    const panel: MissionPanel = { root, mission, selectedId: null, getCenter, title, count, list, input, dragId: null, expanded: new Set()}

    form.addEventListener("submit", (e) => {
        e.preventDefault()
        const parsed = parseTargetInput(input.value.trim())
        if (parsed.error) {
            input.classList.add("invalid")
            return
        }
        input.classList.remove("invalid")
        mpAdd(panel, parsed.name, parsed.coords)
        input.value = ""
    })
    input.addEventListener("input", () => input.classList.remove("invalid"))
    mpRender(panel)
    return panel
}

let saveChain: Promise<unknown> = Promise.resolve()

function mpSave(p: MissionPanel) {
    if (!window.missionStore) return
    const snapshot = JSON.parse(JSON.stringify(p.mission)) as Mission
    // chain the writes so they run strictly one after another
    saveChain = saveChain
        .then(() => window.missionStore!.save(snapshot))
        .catch((err) => console.error("Cant save mission", err))
}

function mpRender(p: MissionPanel) {
    p.title.textContent = p.mission.name
    p.count.textContent = String(p.mission.targets.length)

    p.list.replaceChildren(...p.mission.targets.map((t) => {
        const li = el("li", t.id === p.selectedId ? "mp-target selected" : "mp-target")
        li.draggable = true

        const isAfter = (e: DragEvent) => {
            const rect = li.getBoundingClientRect()
            return e.clientY > rect.top + rect.height / 2
        }
        const clearMarks = () => li.classList.remove("drop-before", "drop-after")

        li.addEventListener("dragstart", (e) => {
            p.dragId = t.id
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = "move"
                e.dataTransfer.setData("text/plain", t.id)
            }
            li.classList.add("dragging")
        })
        li.addEventListener("dragend", () => {
            p.dragId = null
            li.classList.remove("dragging")
            p.list.querySelectorAll(".drop-before, .drop-after")
                .forEach(n => n.classList.remove("drop-before", "drop-after"))
        })
        li.addEventListener("dragover", (e) => {
            if (p.dragId === null || p.dragId === t.id) return
            e.preventDefault()
            const after = isAfter(e)
            li.classList.toggle("drop-after", after)
            li.classList.toggle("drop-before", !after)
        })
        li.addEventListener("dragleave", clearMarks)
        li.addEventListener("drop", (e) => {
            e.preventDefault()
            clearMarks()
            if (p.dragId === null) return

            const targets = p.mission.targets
            const beforeId = isAfter(e)
                ? (targets[targets.findIndex(x => x.id === t.id) + 1]?.id ?? null)
                : t.id
            mpMove(p, p.dragId, beforeId)
        })

        const body = el("button", "mp-target-body")
        body.type = "button"
        body.append(
            el("div", "mp-target-name", t.name),
            el("div", "mp-target-meta", `${t.lat.toFixed(3)}°, ${t.lon.toFixed(3)}°`),
        )
        body.addEventListener("click", () => mpSelect(p, t.id))

        const col = el("div", "mp-target-col")
        col.append(body)

        if (t.description) {
            const open = p.expanded.has(t.id)
            col.append(el("div", open ? "mp-target-desc open" : "mp-target-desc", t.description))

            if (t.description.length > 90) {
                const toggle = el("button", "mp-more", open ? "Collapse" : "Read more")
                toggle.type = "button"
                toggle.addEventListener("click", () => {
                    if (open) p.expanded.delete(t.id)
                    else p.expanded.add(t.id)
                    mpRender(p)
                })
                col.append(toggle)
            }
        }

        const del = el("button", "mp-del", "✕")
        del.type = "button"
        del.title = "Remove target"
        del.addEventListener("click", (e) => {
            e.stopPropagation()
            mpRemove(p, t.id)
        })

        li.append(col, del)
        return li
    }))
}

function mpSelect(p: MissionPanel, id: string) {
    const target = p.mission.targets.find(t => t.id === id)
    if (!target) return
    p.selectedId = id
    mpRender(p)
    emit(p, "target-select", target)
}

function mpAdd(p: MissionPanel, name: string, coords?: { lat: number, lon: number } | null) {
    const { lat, lon } = coords ?? p.getCenter()
    const target: Target = {
        id: `t${Date.now()}`,
        name: name || `Target ${p.mission.targets.length + 1}`,
        lat,
        lon,
    }
    p.mission.targets.push(target)
    mpSave(p)
    mpRender(p)
    emit(p, "target-add", target)
}

function mpRemove(p: MissionPanel, id: string) {
    const index = p.mission.targets.findIndex(t => t.id === id)
    if (index < 0) return
    const [target] = p.mission.targets.splice(index, 1)
    if (p.selectedId === id) p.selectedId = null
    mpSave(p)
    mpRender(p)
    emit(p, "target-remove", target)
}
const orderKey = (p: MissionPanel) => `mission-order:${p.mission.name}`

function mpSaveOrder(p: MissionPanel) {
    try {
        localStorage.setItem(orderKey(p), JSON.stringify(p.mission.targets.map(t => t.id)))
    } catch { /* storage unavailable — the order simply won't persist */ }
}

function mpApplySavedOrder(p: MissionPanel) {
    try {
        const raw = localStorage.getItem(orderKey(p))
        if (!raw) return
        const ids = JSON.parse(raw) as string[]
        const rank = new Map(ids.map((id, i) => [id, i]))
        // targets missing from the saved order (new in JSON) go to the end
        const r = (t: Target) => rank.get(t.id) ?? Number.MAX_SAFE_INTEGER
        p.mission.targets.sort((a, b) => r(a) - r(b))
    } catch { /* ignore corrupted data */ }
}

// Moves target `id` before `beforeId` (or to the end when beforeId === null)
function mpMove(p: MissionPanel, id: string, beforeId: string | null) {
    if (id === beforeId) return
    const targets = p.mission.targets
    const from = targets.findIndex(t => t.id === id)
    if (from < 0) return

    const [moved] = targets.splice(from, 1)
    const to = beforeId === null ? targets.length : targets.findIndex(t => t.id === beforeId)
    targets.splice(to < 0 ? targets.length : to, 0, moved)

    mpSave(p)
    mpRender(p)
    p.root.dispatchEvent(new CustomEvent<Target[]>("target-reorder", { detail: [...targets] }))
}

type ParsedInput = { name: string, coords: { lat: number, lon: number } | null, error: boolean }

// "Name lat lon" -> name + coordinates. Without trailing coordinates it is just a name.
function parseTargetInput(text: string): ParsedInput {
    const m = text.match(/^(.*?)[\s;@]*(-?\d+(?:\.\d+)?)°?\s*[,;\s]\s*(-?\d+(?:\.\d+)?)°?\s*$/)
    if (!m) return { name: text, coords: null, error: false }

    const lat = Number(m[2])
    let lon = Number(m[3])
    if (lon > 180 && lon <= 360) lon -= 360   // longitude 0..360 -> -180..180

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return { name: text, coords: null, error: true }
    }
    return { name: m[1].trim(), coords: { lat, lon }, error: false }
}

export type { Target, Mission, MissionPanel }
export { loadMission, createMissionPanel, mpAdd, mpRemove, mpSelect }