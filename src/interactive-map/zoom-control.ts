type ZoomControl = {
    setLevel: (level: number) => void,
    setMaxLevel: (max: number) => void,
}

// Принимает колбэк (вызывается, когда пользователь двигает слайдер)
// и возвращает функции, которыми внешний код сообщает об изменениях.
function createZoomControl(root: HTMLElement, maxLevel: number, onRequest: (level: number) => void): ZoomControl {
    const label = document.createElement("label")
    label.append("Масштаб ")
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
        // программное изменение значения событие "input" не вызывает, цикла нет
        setLevel: (level) => { slider.value = String(level); render() },
        setMaxLevel: (m) => { max = m; render() },
    }
}

export type { ZoomControl }
export { createZoomControl }