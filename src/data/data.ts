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



type Path = {
    points: Point[],
    distance: number,
    elevation: number,
    approximate_angle: number
}
async function parsePath(dataset_path: string): Promise<Path> {
    const points = await pointsOf(dataset_path)
    const first = points[0]
    const last = points[points.length - 1]

    const distance = last.distance
    const elevation = last.elevation - first.elevation
    const approximate_angle = Math.atan((last.elevation - first.elevation) / last.distance)

    return {
        points,
        distance,
        elevation,
        approximate_angle
    }
}

type Region = {
    points: Point[],
    area: number
}
// Vibecoded by Deepseek
function areaOnMars(points: Point[]): number {
    const MARS_RADIUS = 3_396_160 // meters
    const RAD = Math.PI / 180
    
    let total = 0
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const lon1 = points[j].longitude * RAD
        const lat1 = points[j].latitude * RAD 
        const lon2 = points[i].longitude * RAD
        const lat2 = points[i].latitude * RAD
        total += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2))
    }
    return Math.abs(total * MARS_RADIUS * MARS_RADIUS / 2)
}
async function parseRegion(dataset_path: string): Promise<Region> {
    const points = await pointsOf(dataset_path)
    return {
        points,
        area: areaOnMars(points)
    }
}




async function testDatasets() {
    const a1 = await parseRegion("A/1.json")
    const b1 = await parseRegion("B/1.json")
    const b2 = await parseRegion("B/2.json")
    const b3 = await parseRegion("B/3.json")
    const b4 = await parseRegion("B/4.json")
    const b5 = await parseRegion("B/5.json")
    const bg = await parseRegion("B/GeneralArea.json")

    console.log(a1, b1, b2, b3, b4, b5, bg)
}

void testDatasets()

export type { Point, Path, Region }
export { pointsOf, parsePath, parseRegion }

