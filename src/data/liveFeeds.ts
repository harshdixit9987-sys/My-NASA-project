import type { Incident, IncidentCategory } from './incidents'

const USGS_MONTH_FEED =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson'
const EONET_EVENTS = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=1000'
const EONET_WILDFIRES = `${EONET_EVENTS}&category=wildfires`
const EONET_OTHER_CATEGORIES =
  `${EONET_EVENTS}&category=floods,landslides,severeStorms,volcanoes,drought,dustHaze,seaLakeIce,snow,tempExtremes,waterColor`
const NWS_ALERTS = 'https://api.weather.gov/alerts/active'
const ALERT_EVENTS: { event: string; category: 'flood' | 'tsunami' }[] = [
  { event: 'Tsunami Warning', category: 'tsunami' },
  { event: 'Tsunami Watch', category: 'tsunami' },
  { event: 'Tsunami Advisory', category: 'tsunami' },
  { event: 'Flood Warning', category: 'flood' },
  { event: 'Flash Flood Warning', category: 'flood' },
  { event: 'Coastal Flood Warning', category: 'flood' },
]

type FeedFailure = {
  source: string
  message: string
}

export type LiveFeedResult = {
  events: Incident[]
  updatedAt: number
  failures: FeedFailure[]
}

type UsgsFeature = {
  id?: string
  properties?: {
    mag?: number | null
    place?: string | null
    time?: number | null
    url?: string | null
    tsunami?: number | null
    alert?: string | null
  }
  geometry?: {
    coordinates?: number[]
  } | null
}

type NwsFeature = {
  id?: string
  properties?: {
    event?: string
    areaDesc?: string
    severity?: string
    headline?: string
    description?: string
    sent?: string
    effective?: string
    onset?: string
    ends?: string
    web?: string
  }
  geometry?: {
    type?: string
    coordinates?: unknown
  } | null
}

type EonetEvent = {
  id?: string
  title?: string
  link?: string
  categories?: { id?: string; title?: string }[]
  sources?: { id?: string; url?: string }[]
  geometry?: {
    date?: string
    type?: string
    coordinates?: unknown
  }[]
}

const EONET_CATEGORIES: Record<string, IncidentCategory> = {
  floods: 'flood',
  landslides: 'landslide',
  wildfires: 'wildfire',
  severeStorms: 'storm',
  volcanoes: 'volcano',
  drought: 'drought',
  dustHaze: 'other',
  seaLakeIce: 'other',
  snow: 'other',
  tempExtremes: 'other',
  waterColor: 'other',
}

function relativeTime(timestamp: number, now: number): { label: string; daysAgo: number } {
  const elapsedMinutes = Math.max(0, Math.floor((now - timestamp) / 60_000))
  const daysAgo = Math.floor(elapsedMinutes / (60 * 24))

  if (elapsedMinutes < 1) return { label: 'Just now', daysAgo }
  if (elapsedMinutes < 60) return { label: `${elapsedMinutes} min ago`, daysAgo }
  if (elapsedMinutes < 24 * 60) {
    return { label: `${Math.floor(elapsedMinutes / 60)} hr ago`, daysAgo }
  }
  return { label: `${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`, daysAgo }
}

function earthquakeSeverity(magnitude: number): Incident['severity'] {
  if (magnitude >= 5) return 'High'
  if (magnitude >= 4) return 'Moderate'
  return 'Low'
}

function mapEarthquake(feature: UsgsFeature, now: number): Incident | null {
  const properties = feature.properties
  const coordinates = feature.geometry?.coordinates
  const magnitude = properties?.mag
  const timestamp = properties?.time

  if (
    !feature.id ||
    !properties?.place ||
    typeof magnitude !== 'number' ||
    typeof timestamp !== 'number' ||
    !coordinates ||
    coordinates.length < 3 ||
    !Number.isFinite(coordinates[0]) ||
    !Number.isFinite(coordinates[1])
  ) {
    return null
  }

  const [longitude, latitude, depthKm] = coordinates
  const placeParts = properties.place.split(', ')
  const relative = relativeTime(timestamp, now)

  return {
    id: `usgs-${feature.id}`,
    name: `Magnitude ${magnitude.toFixed(1)} earthquake`,
    category: 'earthquake',
    region: placeParts[0] || properties.place,
    country: placeParts.slice(1).join(', ') || 'Global',
    position: [latitude, longitude],
    area: [],
    severity: earthquakeSeverity(magnitude),
    magnitude,
    depthKm: Number.isFinite(depthKm) ? depthKm : undefined,
    daysAgo: relative.daysAgo,
    timeLabel: relative.label,
    settlements: [],
    source: 'USGS',
    sourceUrl: properties.url ?? undefined,
    isDemo: false,
  }
}

function collectCoordinates(value: unknown): [number, number][] {
  if (!Array.isArray(value)) return []
  if (
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  ) {
    return [[value[1], value[0]]]
  }
  return value.flatMap(collectCoordinates)
}

function validCoordinatePair(value: unknown): [number, number] | null {
  if (
    !Array.isArray(value) ||
    typeof value[0] !== 'number' ||
    typeof value[1] !== 'number' ||
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1])
  ) {
    return null
  }
  return [value[1], value[0]]
}

function mapEonetEvent(event: EonetEvent, now: number): Incident | null {
  if (!event.id || !event.title || !event.categories?.length) return null

  const categoryEntry = event.categories.find(
    (item) => item.id && EONET_CATEGORIES[item.id],
  )
  if (!categoryEntry?.id) return null

  const category = EONET_CATEGORIES[categoryEntry.id]
  const geometry = [...(event.geometry ?? [])]
    .filter((item) => item.date && item.coordinates)
    .sort((left, right) => Date.parse(right.date!) - Date.parse(left.date!))[0]
  if (!geometry?.date) return null

  const point =
    geometry.type === 'Point'
      ? validCoordinatePair(geometry.coordinates)
      : null
  const polygonCoordinates =
    geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)
      ? geometry.coordinates[0]
      : geometry.type === 'MultiPolygon' &&
          Array.isArray(geometry.coordinates) &&
          Array.isArray(geometry.coordinates[0])
        ? geometry.coordinates[0][0]
        : null
  const area = collectCoordinates(polygonCoordinates)
  const position =
    point ??
    (area.length > 0
      ? [
          area.reduce((sum, coordinate) => sum + coordinate[0], 0) / area.length,
          area.reduce((sum, coordinate) => sum + coordinate[1], 0) / area.length,
        ] as [number, number]
      : null)
  const timestamp = Date.parse(geometry.date)
  if (!position || !Number.isFinite(timestamp)) return null

  const relative = relativeTime(timestamp, now)
  const source = event.sources?.find((item) => item.url)

  return {
    id: `eonet-${event.id}`,
    name: event.title,
    category,
    region: event.title,
    country: categoryEntry.title ?? category,
    position,
    area,
    severity: 'Unknown',
    daysAgo: relative.daysAgo,
    timeLabel: relative.label,
    settlements: [],
    source: 'NASA EONET',
    sourceUrl: source?.url ?? event.link,
    isDemo: false,
  }
}

function firstPolygonRing(
  geometry: NwsFeature['geometry'],
): [number, number][] {
  if (!geometry || !Array.isArray(geometry.coordinates)) return []

  const coordinates = geometry.coordinates
  const firstPolygon =
    geometry.type === 'MultiPolygon' && Array.isArray(coordinates[0])
      ? coordinates[0]
      : coordinates
  const firstRing = Array.isArray(firstPolygon) ? firstPolygon[0] : null

  return collectCoordinates(firstRing)
}

function getAlertSeverity(value?: string): Incident['severity'] {
  if (value === 'Extreme' || value === 'Severe') return 'High'
  if (value === 'Moderate') return 'Moderate'
  return 'Low'
}

function mapAlert(
  feature: NwsFeature,
  category: 'flood' | 'tsunami',
): Incident | null {
  const properties = feature.properties
  const name = properties?.event
  const id = feature.id

  if (!name || !id) return null

  const area = firstPolygonRing(feature.geometry)
  const position: [number, number] | null =
    area.length > 0
      ? [
          area.reduce((sum, point) => sum + point[0], 0) / area.length,
          area.reduce((sum, point) => sum + point[1], 0) / area.length,
        ]
      : null
  return {
    id: `nws-${id}`,
    name: properties.headline?.trim() || name,
    category,
    region: properties.areaDesc?.trim() || 'Area not provided by alert',
    country: 'United States',
    position,
    area,
    severity: getAlertSeverity(properties.severity),
    daysAgo: 0,
    timeLabel: 'Active official alert',
    settlements: [],
    source: 'NWS',
    sourceUrl: properties.web ?? 'https://www.weather.gov/alerts',
    isDemo: false,
  }
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: 'application/geo+json, application/json' },
    signal,
  })

  if (!response.ok) {
    throw new Error(`Request failed (${response.status} ${response.statusText})`)
  }

  return response.json()
}

function getFeatures(payload: unknown): unknown[] {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'features' in payload &&
    Array.isArray(payload.features)
  ) {
    return payload.features
  }
  throw new Error('The data provider returned an unexpected response.')
}

async function loadEarthquakes(
  signal: AbortSignal,
  now: number,
): Promise<Incident[]> {
  const payload = await fetchJson(USGS_MONTH_FEED, signal)
  return getFeatures(payload)
    .map((feature) => mapEarthquake(feature as UsgsFeature, now))
    .filter((event): event is Incident => event !== null)
}

async function loadEonetEvents(
  url: string,
  signal: AbortSignal,
  now: number,
): Promise<Incident[]> {
  const payload = await fetchJson(url, signal)
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('events' in payload) ||
    !Array.isArray(payload.events)
  ) {
    throw new Error('The NASA EONET feed returned an unexpected response.')
  }
  return payload.events
    .map((event) => mapEonetEvent(event as EonetEvent, now))
    .filter((event): event is Incident => event !== null)
}

async function loadAlertType(
  alert: (typeof ALERT_EVENTS)[number],
  signal: AbortSignal,
): Promise<Incident[]> {
  const url = `${NWS_ALERTS}?event=${encodeURIComponent(alert.event)}`
  const payload = await fetchJson(url, signal)
  return getFeatures(payload)
    .map((feature) => mapAlert(feature as NwsFeature, alert.category))
    .filter((event): event is Incident => event !== null)
}

export async function fetchLiveObservations(
  signal: AbortSignal,
): Promise<LiveFeedResult> {
  const now = Date.now()
  const sources = await Promise.allSettled([
    loadEarthquakes(signal, now),
    loadEonetEvents(EONET_WILDFIRES, signal, now),
    loadEonetEvents(EONET_OTHER_CATEGORIES, signal, now),
    ...ALERT_EVENTS.map((event) => loadAlertType(event, signal)),
  ])
  const events: Incident[] = []
  const failures: FeedFailure[] = []

  sources.forEach((result, index) => {
    const source =
      index === 0
        ? 'USGS earthquakes'
        : index === 1
          ? 'NASA EONET wildfires'
          : index === 2
            ? 'NASA EONET other natural events'
            : `NWS ${ALERT_EVENTS[index - 3].event}`
    if (result.status === 'fulfilled') {
      events.push(...result.value)
    } else if (!signal.aborted) {
      failures.push({
        source,
        message:
          result.reason instanceof Error
            ? result.reason.message
            : 'Could not load this feed.',
      })
    }
  })

  const uniqueEvents = Array.from(
    new Map(events.map((event) => [event.id, event])).values(),
  )

  uniqueEvents.sort((left, right) => {
    const categoryOrder: Record<IncidentCategory, number> = {
      tsunami: 0,
      earthquake: 1,
      flood: 2,
      landslide: 3,
      wildfire: 4,
      storm: 5,
      volcano: 6,
      drought: 7,
      other: 8,
    }
    return (
      categoryOrder[left.category] - categoryOrder[right.category] ||
      left.daysAgo - right.daysAgo
    )
  })

  return { events: uniqueEvents, updatedAt: now, failures }
}
