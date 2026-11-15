import type { LayerInfo } from "./layers.ts"

function createLayerPanel(root: HTMLElement, layers: LayerInfo[], activeId: string, onSelect: (id: string) => void): (id: string) => void {
    const buttons = new Map<string, HTMLButtonElement>()

    for (const layer of layers) {
        const b = document.createElement("button")
        b.type = "button"
        b.textContent = layer.name
        b.title = layer.description
        b.addEventListener("click", () => onSelect(layer.id))
        buttons.set(layer.id, b)
    }
    root.replaceChildren(...buttons.values())

    const setActive = (id: string) => {
        for (const [bid, b] of buttons) b.classList.toggle("active", bid === id)
    }
    setActive(activeId)
    return setActive
}

export { createLayerPanel }