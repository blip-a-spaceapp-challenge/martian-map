type ZoomControl = {
    setLevel: (level: number) => void,
    setMaxLevel: (max: number) => void,
}

// Takes a callback (fired when the user moves the slider)
// and returns the functions the outside code uses to report changes.
function createZoomControl(root: HTMLElement, maxLevel: number, onRequest: (level: number) => void): ZoomControl {
    const label = document.createElement("label")
    label.append("Zoom ")
    const slider = document.createElement("input")
    slider.type = "range"
    slider.min = "0"
    slider.step = "1"
    const out = document.createElement("output")
    label.append(slider, out)
    root.replaceChildren(label)

    let max = maxLevel
    const render = () => {
        slider.max = String(max)
        out.textContent = `${slider.value} / ${max}`
    }

    slider.addEventListener("input", () => {
        render()
        onRequest(Number(slider.value))
    })

    render()
    return {
        // setting the value programmatically does not fire "input", so there is no loop
        setLevel: (level) => { slider.value = String(level); render() },
        setMaxLevel: (m) => { max = m; render() },
    }
}

export type { ZoomControl }
export { createZoomControl }