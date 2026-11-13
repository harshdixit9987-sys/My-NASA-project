export type IncidentCategory =
  | 'flood'
  | 'landslide'
  | 'earthquake'
  | 'tsunami'
  | 'wildfire'
  | 'storm'
  | 'volcano'
  | 'drought'
  | 'other'

export type Incident = {
  id: string
  name: string
  category: IncidentCategory
  region: string
  country: string
  position: [number, number] | null
  area: [number, number][]
  severity: 'High' | 'Moderate' | 'Low' | 'Unknown'
  confidence?: number
  areaKm2?: number
  magnitude?: number
  depthKm?: number
  source?: string
  sourceUrl?: string
  isDemo?: boolean
  daysAgo: number
  timeLabel: string
  settlements: { name: string; position: [number, number] }[]
}

export const incidents: Incident[] = [
  {
    id: 'assam-flood',
    name: 'Brahmaputra flood extent',
    category: 'flood',
    region: 'Dibrugarh, Assam',
    country: 'India',
    position: [27.48, 94.91],
    area: [[27.64, 94.66], [27.72, 94.93], [27.57, 95.14], [27.35, 95.1], [27.27, 94.84], [27.43, 94.67]],
    severity: 'High',
    confidence: 94,
    areaKm2: 128,
    daysAgo: 0,
    timeLabel: '38 min ago',
    isDemo: true,
    settlements: [
      { name: 'Dibrugarh', position: [27.49, 94.92] },
      { name: 'Moran', position: [27.18, 94.92] },
      { name: 'Tinsukia', position: [27.49, 95.36] },
    ],
  },
  {
    id: 'nepal-landslide',
    name: 'Hill-slope movement',
    category: 'landslide',
    region: 'Sindhupalchok',
    country: 'Nepal',
    position: [27.95, 85.86],
    area: [[28.04, 85.72], [28.11, 85.9], [27.97, 86.03], [27.85, 85.96], [27.88, 85.79]],
    severity: 'High',
    confidence: 87,
    areaKm2: 42,
    daysAgo: 1,
    timeLabel: '6 hours ago',
    isDemo: true,
    settlements: [
      { name: 'Chautara', position: [27.78, 85.72] },
      { name: 'Melamchi', position: [27.83, 85.58] },
    ],
  },
  {
    id: 'sundarbans-water',
    name: 'Coastal water expansion',
    category: 'flood',
    region: 'Sundarbans, West Bengal',
    country: 'India',
    position: [21.91, 88.61],
    area: [[22.05, 88.46], [22.12, 88.7], [21.95, 88.83], [21.78, 88.71], [21.81, 88.52]],
    severity: 'Moderate',
    confidence: 91,
    areaKm2: 76,
    daysAgo: 3,
    timeLabel: '3 days ago',
    isDemo: true,
    settlements: [
      { name: 'Canning', position: [22.32, 88.67] },
      { name: 'Basanti', position: [22.19, 88.68] },
    ],
  },
  {
    id: 'kutch-ground',
    name: 'Surface displacement watch',
    category: 'earthquake',
    region: 'Kutch, Gujarat',
    country: 'India',
    position: [23.25, 69.67],
    area: [[23.4, 69.48], [23.47, 69.72], [23.31, 69.86], [23.11, 69.79], [23.15, 69.57]],
    severity: 'Moderate',
    confidence: 82,
    areaKm2: 53,
    daysAgo: 6,
    timeLabel: '6 days ago',
    isDemo: true,
    settlements: [
      { name: 'Bhuj', position: [23.24, 69.67] },
      { name: 'Anjar', position: [23.11, 70.02] },
    ],
  },
  {
    id: 'kerala-rainfall',
    name: 'River basin inundation',
    category: 'flood',
    region: 'Wayanad, Kerala',
    country: 'India',
    position: [11.69, 76.13],
    area: [[11.82, 75.95], [11.89, 76.19], [11.74, 76.34], [11.55, 76.28], [11.57, 76.04]],
    severity: 'Low',
    confidence: 78,
    areaKm2: 31,
    daysAgo: 13,
    timeLabel: '13 days ago',
    isDemo: true,
    settlements: [
      { name: 'Kalpetta', position: [11.61, 76.08] },
      { name: 'Mananthavady', position: [11.8, 76.0] },
    ],
  },
]
