export type GeocodedLocation = {
  id: string
  name: string
  displayName: string
  position: [number, number]
  provider: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function searchLocations(
  query: string,
  signal: AbortSignal,
): Promise<GeocodedLocation[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '5',
  })
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: { Accept: 'application/json' },
      signal,
    },
  )

  if (!response.ok) {
    throw new Error(`Location search failed (${response.status} ${response.statusText})`)
  }

  const payload: unknown = await response.json()
  if (!Array.isArray(payload)) {
    throw new Error('The location provider returned an unexpected response.')
  }

  const locations = payload.flatMap((item: unknown) => {
    if (!isRecord(item)) return []

    const latitude = typeof item.lat === 'string' ? Number(item.lat) : Number.NaN
    const longitude = typeof item.lon === 'string' ? Number(item.lon) : Number.NaN
    const displayName =
      typeof item.display_name === 'string' ? item.display_name.trim() : ''

    if (
      !displayName ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return []
    }

    const name =
      typeof item.name === 'string' && item.name.trim()
        ? item.name.trim()
        : displayName.split(',')[0]
    const id =
      (typeof item.place_id === 'number' && Number.isFinite(item.place_id)
        ? item.place_id.toString()
        : null) ??
      `${typeof item.osm_type === 'string' ? item.osm_type : 'place'}-${typeof item.osm_id === 'number' ? item.osm_id : displayName}`
    const position: [number, number] = [latitude, longitude]

    return [{
      id,
      name,
      displayName,
      position,
      provider: 'OpenStreetMap',
    }]
  })

  const uniqueLocations = new Map<string, GeocodedLocation>()
  for (const location of locations) {
    const key = location.displayName.toLocaleLowerCase()
    if (!uniqueLocations.has(key)) uniqueLocations.set(key, location)
  }

  return Array.from(uniqueLocations.values())
}
