type Point = {
    longitude: number,
    latitude: number,
    distance: number,
    elevation: number
}

type Profile = {
    DEM: string,
    Path: Point[]
}
type Dataset = {
    Profiles: Profile[]
}

async function pointsOf(dataset_path: string): Promise<Point[]> {
    const response = await fetch(`./regions/${dataset_path}`)
    if (!response.ok) throw new Error(`could not fetch ${dataset_path} dataset! ${response.status}`);

    try { 
        const dataset = await response.json() as Dataset
        return dataset.Profiles[0].Path
    } catch {
        throw new Error("is not a valid JSON!")
    }
}

async function testDatasets() {
    const a1 = await pointsOf("A/1.json")
    const b1 = await pointsOf("B/1.json")
    const b2 = await pointsOf("B/2.json")
    const b3 = await pointsOf("B/3.json")
    const b4 = await pointsOf("B/4.json")
    const b5 = await pointsOf("B/5.json")
    const bg = await pointsOf("B/GeneralArea.json")

    console.log(a1, b1, b2, b3, b4, b5, bg)
}

void testDatasets()

export type { Point }
export { pointsOf }

