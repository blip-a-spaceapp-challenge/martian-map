import type { LayerInfo } from "./layers.ts"

type LayerState = {
    visible: boolean,
    opacity: number,
}

// A list of map layers, one row each: a checkbox turns the layer on and off,
// the slider below it sets the opacity. onChange fires for both controls.
function createLayerList(
    root: HTMLElement,
    layers: LayerInfo[],
    onChange: (index: number, state: LayerState) => void,
): void {
    const title = document.createElement("h2")
    title.className = "ll-title"
    title.textContent = "Layers"

    const list = document.createElement("ul")
    list.className = "ll-list"

    layers.forEach((layer, index) => {
        const item = document.createElement("li")
        item.className = "ll-layer"

        const head = document.createElement("label")
        head.className = "ll-head"

        const toggle = document.createElement("input")
        toggle.className = "ll-toggle"
        toggle.type = "checkbox"
        toggle.checked = layer.visible

        const name = document.createElement("span")
        name.className = "ll-name"
        name.textContent = layer.name

        const value = document.createElement("output")
        value.className = "ll-value"

        head.append(toggle, name, value)
        head.title = layer.description

        const slider = document.createElement("input")
        slider.className = "ll-opacity"
        slider.type = "range"
        slider.min = "0"
        slider.max = "100"
        slider.step = "1"
        slider.value = String(Math.round(layer.opacity * 100))
        slider.title = `${layer.name} opacity`

        const render = () => {
            value.textContent = `${slider.value}%`
            slider.disabled = !toggle.checked
            item.classList.toggle("off", !toggle.checked)
        }

        const emit = () => {
            render()
            onChange(index, { visible: toggle.checked, opacity: Number(slider.value) / 100 })
        }

        toggle.addEventListener("change", emit)
        slider.addEventListener("input", emit)

        render()
        item.append(head, slider)
        list.appendChild(item)
    })

    root.replaceChildren(title, list)
}

export type { LayerState }
export { createLayerList }
