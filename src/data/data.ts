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
    const response = await fetch(`./regions/${dataset_path}.json`)
    if (!response.ok) throw new Error(`could not fetch ${dataset_path} dataset! ${response.status}`);

    try { 
        const dataset = await response.json() as Dataset
        return dataset.Profiles[0].Path
    } catch {
        throw new Error("is not a valid JSON!")
    }
}



const RAD = Math.PI / 180



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
    const approximate_angle = Math.atan2(last.elevation - first.elevation, last.distance) / RAD

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



type Location = {
    generalArea: Region,
    pointsOfInterest: Region[]
}
async function loadLocation(code: string, numberOfPoIs: number): Promise<Location> {
    const generalArea = await parseRegion(`${code}/GeneralArea`)
    let pointsOfInterest = []
    for (let i = 1; i <= numberOfPoIs; i++) {
        const region = await parseRegion(`${code}/${i}`)
        pointsOfInterest.push(region)
    }
    return {
        generalArea,
        pointsOfInterest
    }
}

type Landing = {
    generalArea: Region,
    pathsToLocations: Map<string, Path[]>
}
async function loadLanding(code: string, paths: Map<string, number>): Promise<Landing> {
    const generalArea = await parseRegion(`${code}/GeneralArea`)
    let pathsToLocations = new Map<string, Path[]>()
    for (const [lcode, n] of paths) {
        let paths = []
        for (let i = 1; i <= n; i++) {
            paths.push(await parsePath(`${code}/PathTo${lcode}${n}`))
        }
        pathsToLocations.set(lcode, paths)
    }
    return {
        generalArea,
        pathsToLocations
    }
}

type Datasets = {
    locationA: Location,
    locationB: Location,
    locationC: Location,
    locationD: Location,
    locationE: Location,
    landingA: Landing,
    landingB: Landing,
    landingC: Landing
}
async function loadDatasets(): Promise<Datasets> {
    const locationA = await loadLocation("A", 1)
    const locationB = await loadLocation("B", 5)
    const locationC = await loadLocation("C", 6)
    const locationD = await loadLocation("D", 7)
    const locationE = await loadLocation("E", 1)
    const landingA = await loadLanding("LandingA", new Map([["C", 1], ["D", 1], ["E", 1]]))
    const landingB = await loadLanding("LandingB", new Map([["A", 2], ["B", 1]]))
    const landingC = await loadLanding("LandingC", new Map([["A", 1], ["B", 1], ["C", 1], ["D", 1]]))
    return {
        locationA,
        locationB,
        locationC,
        locationD,
        locationE,
        landingA,
        landingB,
        landingC
    }
}



async function testDatasets() {
    const datasets = await loadDatasets()
    console.log(datasets)
}

void testDatasets()

export type { Point, Path, Region }
export { pointsOf, parsePath, parseRegion }

