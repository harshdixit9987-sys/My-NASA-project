import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  Activity,
  Bot,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Crosshair,
  Globe2,
  Layers3,
  MapPin,
  Menu,
  RefreshCw,
  Radio,
  RotateCcw,
  Search,
  Settings2,
  Shield,
  SlidersHorizontal,
  Waves,
  UserRound,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  Circle,
  CircleMarker,
  MapContainer,
  Polygon,
  Rectangle,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet'
import type { Incident, IncidentCategory } from './data/incidents'
import { incidents } from './data/incidents'
import { fetchLiveObservations } from './data/liveFeeds'
import type { LiveFeedResult } from './data/liveFeeds'
import { searchLocations } from './data/geocoding'
import type { GeocodedLocation } from './data/geocoding'
import { AssistantPanel } from './components/AssistantPanel'
import './App.css'

const AccountMenu = lazy(() =>
  import('./components/AccountMenu').then((module) => ({ default: module.AccountMenu })),
)

type DateWindow = '24h' | '7d' | '30d'
type NearbyRadius = 'all' | '25' | '50' | '100' | '250' | '500'
type BasemapStyle = 'street' | 'satellite' | 'terrain'
type MonitorScope = 'regional' | 'global'
type LayerVisibility = {
  change: boolean
  settlements: boolean
}

function distanceInKm(
  first: [number, number],
  second: [number, number],
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const [firstLat, firstLon] = first.map(radians)
  const [secondLat, secondLon] = second.map(radians)
  const latitudeDelta = secondLat - firstLat
  const longitudeDelta = secondLon - firstLon
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLat) *
      Math.cos(secondLat) *
      Math.sin(longitudeDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

const EVENT_PAGE_SIZE = 100
const WATCH_AREA_BOUNDS: [[number, number], [number, number]] = [
  [23.5, 78],
  [32, 93],
]
const WATCH_AREA_CENTER: [number, number] = [27.75, 85.5]
const WORLD_CENTER: [number, number] = [20, 0]

const basemapOptions: Record<BasemapStyle, { label: string; description: string; url: string }> = {
  street: {
    label: 'Streets',
    description: 'Roads, places, and borders',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  },
  satellite: {
    label: 'Satellite',
    description: 'Satellite imagery with English labels',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  },
  terrain: {
    label: 'Terrain',
    description: 'Topography and physical features',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
  },
}

const categoryLabels: Record<IncidentCategory | 'all', string> = {
  all: 'All events',
  flood: 'Flood',
  landslide: 'Landslide',
  earthquake: 'Earthquake',
  tsunami: 'Tsunami alert (U.S. only)',
  wildfire: 'Wildfire',
  storm: 'Severe storm / cyclone',
  volcano: 'Volcano',
  drought: 'Drought',
  other: 'Other natural events',
}

const categoryColors: Record<IncidentCategory, string> = {
  flood: '#1a73e8',
  landslide: '#ffb45c',
  earthquake: '#dc4b4b',
  tsunami: '#8a4de8',
  wildfire: '#ef7d32',
  storm: '#7b61c9',
  volcano: '#b84b3e',
  drought: '#9a7b3f',
  other: '#547d83',
}

function isWithinWatchArea(incident: Incident): boolean {
  const [southWest, northEast] = WATCH_AREA_BOUNDS
  const position = incident.position
  return Boolean(
    position &&
      position[0] >= southWest[0] &&
      position[0] <= northEast[0] &&
      position[1] >= southWest[1] &&
      position[1] <= northEast[1],
  )
}

function MapController({
  incident,
  focusKey,
  location,
  locationFocusKey,
}: {
  incident: Incident | null
  focusKey: number
  location: GeocodedLocation | null
  locationFocusKey: number
}) {
  const map = useMap()
  const previousFocusKey = useRef(focusKey)
  const previousLocationFocusKey = useRef(locationFocusKey)

  useEffect(() => {
    if (focusKey !== previousFocusKey.current && incident?.position) {
      map.flyTo(incident.position, 7, { duration: 0.8 })
    }
    previousFocusKey.current = focusKey
  }, [focusKey, incident, map])

  useEffect(() => {
    if (locationFocusKey !== previousLocationFocusKey.current && location) {
      map.flyTo(location.position, 11, { duration: 0.8 })
    }
    previousLocationFocusKey.current = locationFocusKey
  }, [location, locationFocusKey, map])

  return null
}

function MapControls({ onReset }: { onReset: () => void }) {
  const map = useMap()

  return (
    <div className="map-control-stack" aria-label="Map controls">
      <button aria-label="Zoom in" onClick={() => map.zoomIn()} type="button">
        <ZoomIn size={17} />
      </button>
      <button aria-label="Zoom out" onClick={() => map.zoomOut()} type="button">
        <ZoomOut size={17} />
      </button>
      <span className="control-divider" />
      <button aria-label="Reset map view" onClick={onReset} type="button">
        <Crosshair size={16} />
      </button>
    </div>
  )
}

function MapCenterReporter({
  onChange,
}: {
  onChange: (center: [number, number]) => void
}) {
  const map = useMap()

  useEffect(() => {
    function updateCenter() {
      const center = map.getCenter()
      onChange([center.lat, center.lng])
    }

    updateCenter()
    map.on('moveend', updateCenter)
    return () => {
      map.off('moveend', updateCenter)
    }
  }, [map, onChange])

  return null
}

function formatCoordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`
}

function downloadGeoJson(items: Incident[]) {
  const collection = {
    type: 'FeatureCollection',
    name: 'SARScope earthquake and hazard reports',
    features: items.map((item) => ({
      type: 'Feature',
      geometry: item.position
        ? {
            type: 'Point',
            coordinates: [item.position[1], item.position[0]],
          }
        : null,
      properties: {
        id: item.id,
        name: item.name,
        category: item.category,
        severity: item.severity,
        confidence: item.confidence,
        areaKm2: item.areaKm2,
        magnitude: item.magnitude,
        depthKm: item.depthKm,
        daysAgo: item.daysAgo,
        source: item.source ?? 'Synthetic demonstration data',
        sourceUrl: item.sourceUrl,
        isDemo: item.isDemo ?? false,
      },
    })),
  }
  const blob = new Blob([JSON.stringify(collection, null, 2)], {
    type: 'application/geo+json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'sarscope-demo-observations.geojson'
  link.click()
  URL.revokeObjectURL(url)
}

function App() {
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [activeSearchIndex, setActiveSearchIndex] = useState(0)
  const [locationResults, setLocationResults] = useState<GeocodedLocation[]>([])
  const [locationSearchLoading, setLocationSearchLoading] = useState(false)
  const [locationSearchError, setLocationSearchError] = useState('')
  const [searchedLocation, setSearchedLocation] = useState<GeocodedLocation | null>(null)
  const [nearbyRadius, setNearbyRadius] = useState<NearbyRadius>('all')
  const [detailOpen, setDetailOpen] = useState(true)
  const [category, setCategory] = useState<IncidentCategory | 'all'>('all')
  const [dateWindow, setDateWindow] = useState<DateWindow>('7d')
  const [selectedId, setSelectedId] = useState(incidents[0].id)
  const [focusSelectedEventKey, setFocusSelectedEventKey] = useState(0)
  const [layers, setLayers] = useState<LayerVisibility>({
    change: true,
    settlements: true,
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [visibleEventCount, setVisibleEventCount] = useState(EVENT_PAGE_SIZE)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [basemap, setBasemap] = useState<BasemapStyle>('street')
  const [dataMode, setDataMode] = useState<'live' | 'demo'>('live')
  const [liveEvents, setLiveEvents] = useState<Incident[]>([])
  const [feedFailures, setFeedFailures] = useState<LiveFeedResult['failures']>([])
  const [feedUpdatedAt, setFeedUpdatedAt] = useState<number | null>(null)
  const [feedLoading, setFeedLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [locationFocusKey, setLocationFocusKey] = useState(0)
  const [monitorScope, setMonitorScope] = useState<MonitorScope>('global')
  const [showFilters, setShowFilters] = useState(false)
  const [mapResetKey, setMapResetKey] = useState(0)
  const [mapCenter, setMapCenter] = useState<[number, number]>(WORLD_CENTER)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const locationSearchController = useRef<AbortController | null>(null)
  const sourceEvents = dataMode === 'live' ? liveEvents : incidents
  const scopedEvents =
    monitorScope === 'regional' ? sourceEvents.filter(isWithinWatchArea) : sourceEvents
  const relevantFeedFailures =
    monitorScope === 'regional'
      ? feedFailures.filter(
          (failure) =>
            failure.source.startsWith('USGS') ||
            failure.source.startsWith('NASA EONET'),
        )
      : feedFailures

  useEffect(() => () => locationSearchController.current?.abort(), [])

  useEffect(() => {
    const controller = new AbortController()
    let firstRequest = true

    async function refreshFeeds() {
      if (firstRequest) setFeedLoading(true)
      try {
        const result = await fetchLiveObservations(controller.signal)
        if (controller.signal.aborted) return
        setLiveEvents(result.events)
        setFeedFailures(result.failures)
        setFeedUpdatedAt(result.updatedAt)
      } catch (error) {
        if (controller.signal.aborted) return
        setFeedFailures([
          {
            source: 'Live feeds',
            message: error instanceof Error ? error.message : 'Unexpected feed error.',
          },
        ])
      } finally {
        if (!controller.signal.aborted) {
          setFeedLoading(false)
          firstRequest = false
        }
      }
    }

    void refreshFeeds()
    const intervalId = window.setInterval(() => {
      void refreshFeeds()
    }, 5 * 60 * 1000)

    return () => {
      controller.abort()
      window.clearInterval(intervalId)
    }
  }, [refreshKey])

  const searchResults = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return []

    return scopedEvents.filter((incident) => {
      const searchableText = [
        incident.name,
        incident.region,
        incident.country,
        incident.category,
        ...incident.settlements.map((settlement) => settlement.name),
      ]
        .join(' ')
        .toLocaleLowerCase()

      return searchableText.includes(normalizedQuery)
    })
  }, [query, scopedEvents])

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  const filteredIncidents = useMemo(() => {
    const maxDays = dateWindow === '24h' ? 1 : dateWindow === '7d' ? 7 : 30
    const normalizedQuery = query.trim().toLocaleLowerCase()

    return scopedEvents.filter((incident) => {
      const matchesCategory = category === 'all' || incident.category === category
      const matchesDate = incident.daysAgo <= maxDays
      const matchesQuery =
        locationResults.length > 0 ||
        normalizedQuery.length === 0 ||
        `${incident.name} ${incident.region} ${incident.country} ${incident.category} ${incident.settlements.map((settlement) => settlement.name).join(' ')}`
          .toLocaleLowerCase()
          .includes(normalizedQuery)
      const matchesRadius =
        nearbyRadius === 'all' ||
        (searchedLocation !== null &&
          incident.position !== null &&
          distanceInKm(searchedLocation.position, incident.position) <= Number(nearbyRadius))

      return matchesCategory && matchesDate && matchesQuery && matchesRadius
    })
  }, [
    category,
    dateWindow,
    locationResults.length,
    nearbyRadius,
    query,
    scopedEvents,
    searchedLocation,
  ])

  const visibleIncidents = filteredIncidents.slice(0, visibleEventCount)
  const selectedIncident =
    filteredIncidents.find((incident) => incident.id === selectedId) ??
    filteredIncidents[0] ??
    null

  function resetView() {
    setVisibleEventCount(EVENT_PAGE_SIZE)
    setQuery('')
    setLocationResults([])
    setLocationSearchError('')
    setSearchedLocation(null)
    setNearbyRadius('all')
    setMonitorScope('global')
    setCategory('all')
    setDateWindow('7d')
    setNearbyRadius('all')
    setSelectedId(sourceEvents.filter(isWithinWatchArea)[0]?.id ?? '')
    setDetailOpen(true)
    setMapResetKey((key) => key + 1)
  }

  function selectIncident(incident: Incident) {
    setVisibleEventCount(EVENT_PAGE_SIZE)
    setSearchedLocation(null)
    setNearbyRadius('all')
    setCategory('all')
    setDateWindow(incident.daysAgo <= 1 ? '24h' : incident.daysAgo <= 7 ? '7d' : '30d')
    setSelectedId(incident.id)
    setFocusSelectedEventKey((key) => key + 1)
    setDetailOpen(true)
    setSidebarOpen(false)
    setSearchFocused(false)
    searchInputRef.current?.blur()
  }

  async function searchForLocation() {
    const locationQuery = query.trim()
    if (!locationQuery) {
      searchInputRef.current?.focus()
      return
    }

    locationSearchController.current?.abort()
    const controller = new AbortController()
    locationSearchController.current = controller
    setLocationSearchLoading(true)
    setLocationSearchError('')
    setLocationResults([])

    try {
      const coordinateMatch = locationQuery.match(
        /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/,
      )
      let results: GeocodedLocation[]
      if (coordinateMatch) {
        const latitude = Number(coordinateMatch[1])
        const longitude = Number(coordinateMatch[2])
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          throw new Error('Coordinates must be latitude −90 to 90 and longitude −180 to 180.')
        }
        results = [{
          id: `coordinates-${latitude}-${longitude}`,
          name: 'Selected coordinates',
          displayName: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          position: [latitude, longitude],
          provider: 'Entered coordinates',
        }]
      } else {
        results = await searchLocations(locationQuery, controller.signal)
      }
      if (controller.signal.aborted) return
      setLocationResults(results)
      if (results.length === 0) {
        setLocationSearchError('No matching location found. Try adding a city or country.')
      } else {
        focusLocation(results[0])
        setSearchFocused(true)
      }
    } catch (error) {
      if (controller.signal.aborted) return
      setLocationSearchError(
        error instanceof Error ? error.message : 'Location search could not be completed.',
      )
    } finally {
      if (!controller.signal.aborted) setLocationSearchLoading(false)
    }
  }

  function focusLocation(location: GeocodedLocation) {
    setVisibleEventCount(EVENT_PAGE_SIZE)
    setSearchedLocation(location)
    setNearbyRadius('all')
    setLocationFocusKey((key) => key + 1)
    setSelectedId('')
    setDetailOpen(false)
    setSidebarOpen(false)
  }

  function selectLocation(location: GeocodedLocation) {
    focusLocation(location)
    setQuery('')
    setLocationResults([])
    setLocationSearchError('')
    setSearchFocused(false)
    setSidebarOpen(false)
    searchInputRef.current?.blur()
  }

  function changeBasemap(style: BasemapStyle) {
    setBasemap(style)
    setSettingsOpen(false)
  }

  function changeDataMode(mode: 'live' | 'demo') {
    setVisibleEventCount(EVENT_PAGE_SIZE)
    setDataMode(mode)
    const events = mode === 'live' ? liveEvents : incidents
    setSelectedId(
      (monitorScope === 'regional' ? events.filter(isWithinWatchArea) : events)[0]?.id ?? '',
    )
    setDetailOpen(true)
    setQuery('')
    setCategory('all')
  }

  function changeMonitorScope(scope: MonitorScope) {
    setMonitorScope(scope)
    setVisibleEventCount(EVENT_PAGE_SIZE)
    setQuery('')
    setCategory('all')
    setSearchedLocation(null)
    setSelectedId(
      (scope === 'regional' ? sourceEvents.filter(isWithinWatchArea) : sourceEvents)[0]?.id ?? '',
    )
    setMapResetKey((key) => key + 1)
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      if (query) {
        setQuery('')
        setActiveSearchIndex(0)
      } else {
        setSearchFocused(false)
        searchInputRef.current?.blur()
      }
      return
    }

    if (event.key === 'ArrowDown' && searchResults.length > 0) {
      event.preventDefault()
      setActiveSearchIndex((index) => (index + 1) % searchResults.length)
    }

    if (event.key === 'ArrowUp' && searchResults.length > 0) {
      event.preventDefault()
      setActiveSearchIndex((index) => (index - 1 + searchResults.length) % searchResults.length)
    }

    if (event.key === 'Enter' && searchResults[activeSearchIndex]) {
      event.preventDefault()
      selectIncident(searchResults[activeSearchIndex])
    } else if (event.key === 'Enter') {
      event.preventDefault()
      void searchForLocation()
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-group">
          <button
            aria-label="Open event list"
            className="mobile-menu icon-button"
            onClick={() => setSidebarOpen((open) => !open)}
            type="button"
          >
            <Menu size={19} />
          </button>
          <div className="brand-mark" aria-hidden="true">
            <Radio size={20} strokeWidth={2.2} />
          </div>
          <div className="brand-copy">
            <span className="brand-name">SAR<span>scope</span></span>
            <span className="brand-subtitle">EARTH OBSERVATION CONSOLE</span>
          </div>
        </div>

        <div className={`header-search ${searchFocused ? 'search-focused' : ''}`}>
          <button
            aria-label="Search location"
            className="search-submit"
            disabled={locationSearchLoading}
            onClick={() => void searchForLocation()}
            onMouseDown={(event) => event.preventDefault()}
            title="Search the map for this location"
            type="button"
          >
            <Search size={16} />
          </button>
          <input
            aria-label="Search any place, coordinates, or event"
            aria-autocomplete="list"
            aria-controls="search-results"
            aria-expanded={searchFocused && query.trim().length > 0}
            onBlur={() => {
              window.setTimeout(() => setSearchFocused(false), 120)
            }}
            onChange={(event) => {
              setVisibleEventCount(EVENT_PAGE_SIZE)
              setQuery(event.target.value)
              setActiveSearchIndex(0)
              locationSearchController.current?.abort()
              locationSearchController.current = null
              setLocationSearchLoading(false)
              setLocationResults([])
              setLocationSearchError('')
            }}
            onFocus={() => setSearchFocused(true)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search any city, place, event, or lat, lon..."
            ref={searchInputRef}
            role="combobox"
            autoComplete="off"
            value={query}
          />
          {query && (
            <button
              aria-label="Clear search"
              className="search-clear"
              onClick={() => {
                setVisibleEventCount(EVENT_PAGE_SIZE)
                setQuery('')
                setActiveSearchIndex(0)
                searchInputRef.current?.focus()
              }}
              type="button"
            >
              <X size={14} />
            </button>
          )}
          <kbd>Ctrl K</kbd>
          {searchFocused && query.trim().length > 0 && (
            <div className="search-results" id="search-results" role="listbox" aria-label="Search results">
              <button
                className="search-location-action"
                disabled={locationSearchLoading}
                onClick={() => void searchForLocation()}
                onMouseDown={(event) => event.preventDefault()}
                type="button"
              >
                <MapPin size={14} />
                <span>
                  <strong>{locationSearchLoading ? 'Searching worldwide…' : `Find “${query.trim()}” on the map`}</strong>
                  <small>Search any place or enter coordinates: 27.72, 85.32</small>
                </span>
              </button>
              {locationResults.length > 0 && (
                <>
                  <div className="search-results-heading">
                    <span>LOCATION RESULTS</span>
                    <span>{locationResults.length} found</span>
                  </div>
                  {locationResults.map((location) => (
                    <button
                      aria-pressed={searchedLocation?.id === location.id}
                      className={`search-result search-place-result ${searchedLocation?.id === location.id ? 'search-result-active' : ''}`}
                      key={location.id}
                      onClick={() => selectLocation(location)}
                      role="option"
                      type="button"
                    >
                      <MapPin className="search-result-dot" size={15} />
                      <span className="search-result-copy">
                        <strong>{location.name}</strong>
                        <span>{location.displayName}</span>
                      </span>
                    </button>
                  ))}
                  <div className="search-attribution">
                    Location search by {locationResults[0]?.provider === 'OpenStreetMap'
                      ? 'OpenStreetMap contributors'
                      : 'entered coordinates'}
                  </div>
                </>
              )}
              {locationSearchLoading && (
                <div className="search-message">Looking up the location…</div>
              )}
              {locationSearchError && (
                <div className="search-message search-error">{locationSearchError}</div>
              )}
              {searchResults.length > 0 ? (
                <>
                  <div className="search-results-heading">
                    <span>MAP RESULTS</span>
                    <span>{searchResults.length} found</span>
                  </div>
                  {searchResults.slice(0, 6).map((incident, index) => (
                    <button
                      aria-selected={activeSearchIndex === index}
                      className={`search-result ${activeSearchIndex === index ? 'search-result-active' : ''}`}
                      key={incident.id}
                      onClick={() => selectIncident(incident)}
                      onMouseEnter={() => setActiveSearchIndex(index)}
                      role="option"
                      type="button"
                    >
                      <span
                        className="search-result-dot"
                        style={{ backgroundColor: categoryColors[incident.category] }}
                      />
                      <span className="search-result-copy">
                        <strong>{incident.name}</strong>
                        <span>{incident.region}, {incident.country}</span>
                      </span>
                      <span className="search-result-type">{incident.category}</span>
                    </button>
                  ))}
                  {searchResults.length > 6 && (
                    <div className="search-results-footer">
                      Showing 6 of {searchResults.length} results
                    </div>
                  )}
                </>
              ) : (
                locationResults.length === 0 &&
                !locationSearchLoading &&
                !locationSearchError && (
                  <div className="search-no-results">
                    <Search size={17} />
                    <strong>No matching events</strong>
                    <span>Use “Find on the map” to search for any location.</span>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <div className="topbar-actions">
          <div className={`live-status ${dataMode === 'live' ? 'feed-live' : 'feed-demo'}`}>
            <span />
            {dataMode === 'live'
              ? (relevantFeedFailures.length ? 'PARTIAL FEED' : 'LIVE · GLOBAL SOURCES')
              : 'SYNTHETIC DEMO'}
          </div>
          {dataMode === 'live' && (
            <button
              aria-label="Refresh live data"
              className="refresh-button"
              disabled={feedLoading}
              onClick={() => setRefreshKey((key) => key + 1)}
              title={feedUpdatedAt ? `Last updated ${new Date(feedUpdatedAt).toLocaleTimeString()}` : 'Refresh live data'}
              type="button"
            >
              <RefreshCw className={feedLoading ? 'refresh-spinning' : ''} size={15} />
            </button>
          )}
          <button
            className="export-button"
            onClick={() => downloadGeoJson(filteredIncidents)}
            type="button"
          >
            <ArrowDownToLine size={15} />
            <span>Export</span>
          </button>
          <button
            aria-expanded={assistantOpen}
            className={`assistant-toggle ${assistantOpen ? 'assistant-toggle-active' : ''}`}
            onClick={() => setAssistantOpen((open) => !open)}
            type="button"
          >
            <Bot size={16} />
            <span>AI assistant</span>
          </button>
          <button
            aria-expanded={settingsOpen}
            aria-label="Map settings"
            className={`settings-toggle ${settingsOpen ? 'settings-toggle-active' : ''}`}
            onClick={() => setSettingsOpen((open) => !open)}
            title="Map settings"
            type="button"
          >
            <Settings2 size={17} />
          </button>
          {settingsOpen && (
            <div className="settings-popover" role="dialog" aria-label="Map settings">
              <div className="settings-popover-heading">
                <div>
                  <strong>Map settings</strong>
                  <span>Customize your map</span>
                </div>
                <button
                  aria-label="Close map settings"
                  className="settings-close"
                  onClick={() => setSettingsOpen(false)}
                  type="button"
                >
                  <X size={15} />
                </button>
              </div>
              <span className="settings-label">DATA MODE</span>
              <div className="data-mode-options">
                <button
                  aria-pressed={dataMode === 'live'}
                  className={dataMode === 'live' ? 'data-mode-active' : ''}
                  onClick={() => changeDataMode('live')}
                  type="button"
                >
                  <span><Radio size={15} /> Live official feeds</span>
                  <small>NASA EONET & USGS worldwide · NOAA alerts U.S. only</small>
                </button>
                <button
                  aria-pressed={dataMode === 'demo'}
                  className={dataMode === 'demo' ? 'data-mode-active' : ''}
                  onClick={() => changeDataMode('demo')}
                  type="button"
                >
                  <span><Layers3 size={15} /> Demo overlays</span>
                  <small>Synthetic examples only</small>
                </button>
              </div>
              <div className="settings-separator" />
              <p className="settings-note">
                Earthquakes cannot be predicted. Official alerts are monitoring information,
                not a guarantee of safety.
              </p>
              <div className="settings-separator" />
              <span className="settings-label">MAP TYPE</span>
              <div className="basemap-options">
                {(Object.keys(basemapOptions) as BasemapStyle[]).map((style) => (
                  <button
                    aria-pressed={basemap === style}
                    className={`basemap-option ${basemap === style ? 'basemap-option-active' : ''}`}
                    key={style}
                    onClick={() => changeBasemap(style)}
                    type="button"
                  >
                    <span className={`basemap-preview basemap-preview-${style}`}>
                      {basemap === style && <Check size={14} />}
                    </span>
                    <span className="basemap-option-copy">
                      <strong>{basemapOptions[style].label}</strong>
                      <span>{basemapOptions[style].description}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="settings-separator" />
              <span className="settings-label">MAP LABELS</span>
              <div className="language-setting">
                <Globe2 size={16} />
                <span><strong>English</strong><small>Map labels and interface</small></span>
                <span className="language-fixed">FIXED</span>
              </div>
              <div className="settings-separator" />
              <span className="settings-label">MAP OVERLAYS</span>
              <label className="overlay-setting">
                <span><Layers3 size={15} /> {dataMode === 'live' ? 'Official alert areas' : 'Sample change areas'}</span>
                <input
                  checked={layers.change}
                  onChange={() => setLayers((value) => ({ ...value, change: !value.change }))}
                  type="checkbox"
                />
              </label>
              <label className="overlay-setting">
                <span><MapPin size={15} /> {dataMode === 'live' ? 'Nearby places (demo only)' : 'Sample nearby places'}</span>
                <input
                  checked={layers.settlements}
                  onChange={() => setLayers((value) => ({ ...value, settlements: !value.settlements }))}
                  type="checkbox"
                />
              </label>
            </div>
          )}
          <Suspense
            fallback={
              <button
                aria-label="Loading account"
                className="account-trigger"
                disabled
                type="button"
              >
                <UserRound size={17} />
              </button>
            }
          >
            <AccountMenu />
          </Suspense>
        </div>
      </header>

      <section className="workspace">
        <aside className={`event-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
          <div className="sidebar-heading">
            <div>
              <p className="eyebrow">
                EARTH MONITOR
                <span className={`demo-pill ${dataMode === 'live' ? 'live-pill' : ''}`}>
                  {dataMode === 'live' ? 'LIVE' : 'DEMO'}
                </span>
              </p>
              <h1>Earth signals</h1>
              <p className="sidebar-description">
                {dataMode === 'live'
                  ? 'Global natural-event reports & official feeds'
                  : 'Synthetic SAR-style examples'}
              </p>
            </div>
            <button
              aria-label="Close event list"
              className="mobile-menu icon-button close-sidebar"
              onClick={() => setSidebarOpen(false)}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-label"><Activity size={13} /> {dataMode === 'live' ? 'LIVE EVENTS' : 'DEMO EVENTS'}</span>
              <strong>{filteredIncidents.length.toString().padStart(2, '0')}</strong>
              <span className="stat-note">in selected window</span>
            </div>
            <div className="stat-card">
              <span className="stat-label"><AlertTriangle size={13} /> {dataMode === 'live' ? 'MAG 5+ / SEVERE' : 'HIGH PRIORITY'}</span>
              <strong>
                {filteredIncidents.filter((item) =>
                  item.category === 'earthquake'
                    ? (item.magnitude ?? 0) >= 5
                    : item.severity === 'High',
                ).length.toString().padStart(2, '0')}
              </strong>
              <span className="stat-note">{dataMode === 'live' ? 'not a forecast' : 'demo only'}</span>
            </div>
          </div>

          {dataMode === 'live' && (
            <div className={`feed-summary ${relevantFeedFailures.length ? 'feed-summary-warning' : ''}`}>
              <label className="monitor-area-control" htmlFor="monitor-area">
                <span>MONITORING AREA</span>
                <select
                  id="monitor-area"
                  onChange={(event) => changeMonitorScope(event.target.value as MonitorScope)}
                  value={monitorScope}
                >
                  <option value="global">Worldwide</option>
                  <option value="regional">Nepal · Bihar · southern Tibet</option>
                </select>
              </label>
              {searchedLocation && (
                <label className="monitor-area-control" htmlFor="nearby-radius">
                  <span>REPORTS NEAR {searchedLocation.name.toLocaleUpperCase()}</span>
                  <select
                    id="nearby-radius"
                    onChange={(event) => {
                      setVisibleEventCount(EVENT_PAGE_SIZE)
                      setNearbyRadius(event.target.value as NearbyRadius)
                    }}
                    value={nearbyRadius}
                  >
                    <option value="all">Any distance</option>
                    <option value="25">Within 25 km</option>
                    <option value="50">Within 50 km</option>
                    <option value="100">Within 100 km</option>
                    <option value="250">Within 250 km</option>
                    <option value="500">Within 500 km</option>
                  </select>
                </label>
              )}
              <div className="feed-summary-top">
                <span><span className={`feed-summary-dot ${feedLoading ? 'feed-dot-loading' : ''}`} />{feedLoading ? 'Connecting to global event feeds…' : `${scopedEvents.length} reports · ${scopedEvents.filter((item) => item.category === 'earthquake').length} earthquakes · ${scopedEvents.filter((item) => item.category === 'wildfire').length} fires · ${scopedEvents.filter((item) => item.category === 'storm').length} storms`}</span>
                {feedUpdatedAt && <small>{new Date(feedUpdatedAt).toLocaleTimeString()}</small>}
              </div>
              <p>
                {monitorScope === 'regional'
                  ? 'Approximate map area, not an administrative boundary. NASA EONET natural-event reports and USGS earthquake reports are filtered to this area. NOAA alerts are U.S.-only. No demo detections are shown as live.'
                  : 'Worldwide active natural-event reports from NASA EONET and USGS earthquake reports, plus U.S.-only NOAA alerts. EONET is a curated catalog, not a complete real-time emergency warning system; coverage and reporting times vary. Follow local authorities.'}
              </p>
              {relevantFeedFailures.length > 0 && (
                <details>
                  <summary>{relevantFeedFailures.length} feed{relevantFeedFailures.length === 1 ? '' : 's'} unavailable</summary>
                  {relevantFeedFailures.map((failure) => (
                    <p className="feed-error-detail" key={failure.source}>
                      {failure.source}: {failure.message}
                    </p>
                  ))}
                </details>
              )}
            </div>
          )}

          <div className="section-title-row">
            <div className="section-title"><Waves size={15} /><span>Detected events</span></div>
            <button
              aria-expanded={showFilters}
              aria-label="Toggle event filters"
              className={`filter-button ${showFilters ? 'active' : ''}`}
              onClick={() => setShowFilters((visible) => !visible)}
              type="button"
            >
              <SlidersHorizontal size={15} />
            </button>
          </div>

          {showFilters && (
            <div className="filter-panel">
              <label htmlFor="event-category">Event type</label>
              <div className="select-wrap">
                <select
                  id="event-category"
                  onChange={(event) => {
                    setVisibleEventCount(EVENT_PAGE_SIZE)
                    setCategory(event.target.value as IncidentCategory | 'all')
                  }}
                  value={category}
                >
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            </div>
          )}

          <div className="event-list">
            {visibleIncidents.map((incident) => (
              <button
                className={`event-card ${selectedIncident?.id === incident.id ? 'selected' : ''}`}
                key={incident.id}
                onClick={() => selectIncident(incident)}
                type="button"
              >
                <span
                  className="event-color"
                  style={{ backgroundColor: categoryColors[incident.category] }}
                />
                <span className="event-card-content">
                  <span className="event-card-topline">
                    <span className="event-type">{incident.category}</span>
                    <span className="event-time">{incident.timeLabel}</span>
                  </span>
                  <strong>{incident.name}</strong>
                  <span className="event-location"><MapPin size={12} /> {incident.region}, {incident.country}</span>
                  <span className="event-card-bottom">
                    <span className={`severity severity-${incident.severity.toLowerCase()}`}>
                      {incident.magnitude !== undefined
                        ? `Magnitude ${incident.magnitude.toFixed(1)}`
                        : incident.isDemo
                          ? `${incident.severity} demo`
                          : incident.severity === 'Unknown'
                            ? 'Severity not provided'
                          : `${incident.severity} alert`}
                    </span>
                    <span className="event-confidence">
                      {incident.depthKm !== undefined
                        ? `${incident.depthKm.toFixed(0)} km deep`
                        : incident.source ?? 'Sample'}
                    </span>
                  </span>
                </span>
                {!incident.isDemo && <span className="new-indicator">{incident.source}</span>}
              </button>
            ))}
            {filteredIncidents.length === 0 && (
              <div className="empty-state">
                <Search size={20} />
                <strong>{feedLoading && dataMode === 'live' ? 'Loading official feeds…' : 'No matching events'}</strong>
                <span>
                  {relevantFeedFailures.length && scopedEvents.length === 0 && dataMode === 'live'
                    ? 'Official feeds could not be reached. Check the connection and refresh.'
                    : dataMode === 'live'
                      ? 'No matching official events in this time range. Try another filter or date range.'
                      : 'Try another place, event type, or date range.'}
                </span>
                <button onClick={resetView} type="button">Reset filters</button>
              </div>
            )}
          </div>
          {visibleIncidents.length < filteredIncidents.length && (
            <div className="event-list-more">
              <span>Showing {visibleIncidents.length} of {filteredIncidents.length}</span>
              <button
                onClick={() => setVisibleEventCount((count) => count + EVENT_PAGE_SIZE)}
                type="button"
              >
                Show 100 more
              </button>
            </div>
          )}

          <div className="sidebar-footer">
            <span><Shield size={14} /> {dataMode === 'live' ? 'Official feeds · informational' : 'Synthetic demonstration data'}</span>
            <span>Not a prediction service</span>
          </div>
        </aside>

        <section className="map-stage" aria-label="Worldwide earthquake and hazard monitoring map">
          <MapContainer
            center={monitorScope === 'regional' ? WATCH_AREA_CENTER : WORLD_CENTER}
            className="map-canvas"
            key={mapResetKey}
            maxZoom={17}
            minZoom={2}
            preferCanvas
            scrollWheelZoom
            zoomControl={false}
            zoom={monitorScope === 'regional' ? 5 : 2}
          >
            <TileLayer
              attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Sources: Esri, HERE, Garmin, OpenStreetMap contributors, and the GIS user community'
              url={basemapOptions[basemap].url}
            />
            {basemap === 'satellite' && (
              <TileLayer
                attribution='Labels &copy; <a href="https://www.esri.com/">Esri</a>'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              />
            )}
            <MapController
              incident={selectedIncident}
              focusKey={focusSelectedEventKey}
              location={searchedLocation}
              locationFocusKey={locationFocusKey}
            />
            <MapCenterReporter onChange={setMapCenter} />
            <MapControls
              onReset={() => {
                setSearchedLocation(null)
                setMapResetKey((key) => key + 1)
              }}
            />
            {monitorScope === 'regional' && (
              <Rectangle
                bounds={WATCH_AREA_BOUNDS}
                pathOptions={{
                  color: '#1a73e8',
                  dashArray: '6 5',
                  fill: false,
                  weight: 2,
                }}
              >
                <Tooltip sticky>
                  Approximate monitoring area: Nepal, Bihar, and southern Tibet
                </Tooltip>
              </Rectangle>
            )}
            {searchedLocation && (
              <CircleMarker
                center={searchedLocation.position}
                pathOptions={{
                  color: '#ffffff',
                  fillColor: '#1a73e8',
                  fillOpacity: 1,
                  weight: 3,
                }}
                radius={9}
              >
                <Tooltip direction="top" offset={[0, -8]} permanent>
                  <strong>{searchedLocation.name}</strong>
                </Tooltip>
              </CircleMarker>
            )}
            {searchedLocation && nearbyRadius !== 'all' && (
              <Circle
                center={searchedLocation.position}
                pathOptions={{
                  color: '#1a73e8',
                  fillColor: '#3b82f6',
                  fillOpacity: 0.08,
                  weight: 2,
                }}
                radius={Number(nearbyRadius) * 1000}
              >
                <Tooltip sticky>
                  {nearbyRadius} km search radius around {searchedLocation.name}
                </Tooltip>
              </Circle>
            )}
            {layers.change && filteredIncidents.map((incident) => (
              <Fragment key={incident.id}>
                {incident.area.length >= 3 && (
                  <Polygon
                    eventHandlers={{ click: () => selectIncident(incident) }}
                    pathOptions={{
                      color: categoryColors[incident.category],
                      fillColor: categoryColors[incident.category],
                      fillOpacity: selectedIncident?.id === incident.id ? 0.25 : 0.12,
                      opacity: selectedIncident?.id === incident.id ? 0.9 : 0.6,
                      weight: selectedIncident?.id === incident.id ? 2 : 1,
                    }}
                    positions={incident.area}
                  >
                    <Tooltip direction="top" sticky>
                      <strong>{incident.name}</strong><br />
                      {incident.source === 'NWS'
                        ? 'Official NWS alert'
                        : incident.source === 'NASA EONET'
                          ? 'NASA EONET event report'
                          : incident.source
                            ? `${incident.source} earthquake report`
                            : 'Synthetic sample overlay'}
                    </Tooltip>
                  </Polygon>
                )}
                {incident.position && (
                  <CircleMarker
                    center={incident.position}
                    eventHandlers={{ click: () => selectIncident(incident) }}
                    pathOptions={{
                      color: '#ffffff',
                      fillColor: categoryColors[incident.category],
                      fillOpacity: 1,
                      weight: selectedIncident?.id === incident.id ? 3 : 2,
                    }}
                    radius={selectedIncident?.id === incident.id ? 8 : 6}
                  >
                    <Tooltip direction="top" sticky>
                      <strong>{incident.name}</strong><br />
                      {incident.magnitude !== undefined
                        ? `Magnitude ${incident.magnitude.toFixed(1)} · ${incident.depthKm?.toFixed(0) ?? '—'} km depth`
                        : `${incident.region}, ${incident.country}`}
                    </Tooltip>
                  </CircleMarker>
                )}
                {layers.settlements && incident.settlements.map((settlement, settlementIndex) => (
                  <CircleMarker
                    center={settlement.position}
                    key={`${incident.id}-settlement-${settlementIndex}`}
                    pathOptions={{
                      color: '#e8f4f4',
                      fillColor: '#748d91',
                      fillOpacity: 0.9,
                      weight: 1,
                    }}
                    radius={3}
                  >
                    <Tooltip direction="top">{settlement.name} · illustrative</Tooltip>
                  </CircleMarker>
                ))}
              </Fragment>
            ))}
          </MapContainer>

          <div className="map-topline">
            <div className="map-breadcrumb">
              <span>
                {searchedLocation
                  ? 'SEARCH LOCATION'
                  : monitorScope === 'regional' ? 'REGIONAL WATCH' : 'GLOBAL VIEW'}
              </span>
              <span className="breadcrumb-divider">/</span>
              <strong>
                {searchedLocation?.name ??
                  (monitorScope === 'regional' ? 'NEPAL · BIHAR · TIBET' : 'WORLD')}
              </strong>
              {searchedLocation && (
                <span className="location-attribution">
                  {searchedLocation.provider === 'OpenStreetMap' ? '© OpenStreetMap' : 'Coordinates'}
                </span>
              )}
            </div>
            <div className="map-coordinate">
              <Crosshair size={13} />
              {formatCoordinate(mapCenter[0], 'N', 'S')}&nbsp;
              {formatCoordinate(mapCenter[1], 'E', 'W')}
            </div>
          </div>

          <div className="map-tools">
            <button
              className={`map-tool ${layers.change ? 'tool-active' : ''}`}
              onClick={() => setLayers((value) => ({ ...value, change: !value.change }))}
              type="button"
            >
              <Layers3 size={15} /> <span>{dataMode === 'live' ? 'Alert areas' : 'Change layer'}</span><i />
            </button>
            <button
              className={`map-tool ${layers.settlements ? 'tool-active' : ''}`}
              onClick={() => setLayers((value) => ({ ...value, settlements: !value.settlements }))}
              type="button"
            >
              <MapPin size={15} /> <span>{dataMode === 'live' ? 'Places' : 'Settlements'}</span><i />
            </button>
            <button className="map-tool map-reset" onClick={resetView} type="button">
              <RotateCcw size={14} /><span>Reset</span>
            </button>
          </div>

          {selectedIncident && detailOpen && (
            <div className="detail-card">
              <div className="detail-card-header">
                <div className="detail-symbol" style={{ color: categoryColors[selectedIncident.category] }}>
                  {selectedIncident.category === 'flood' ? <Waves size={17} /> : <Activity size={17} />}
                </div>
                <div className="detail-title">
                  <span className="eyebrow">SELECTED SIGNAL <span className="detail-live-dot" /></span>
                  <strong>{selectedIncident.name}</strong>
                </div>
                <button
                  aria-label="Clear selected signal"
                  className="detail-close"
                  onClick={() => setDetailOpen(false)}
                  type="button"
                >
                  <X size={15} />
                </button>
              </div>
              <p className="detail-place"><MapPin size={13} /> {selectedIncident.region}, {selectedIncident.country}</p>
              <div className="detail-metrics">
                <div>
                  <span>{selectedIncident.magnitude !== undefined ? 'MAGNITUDE' : 'EVENT TYPE'}</span>
                  <strong>
                    {selectedIncident.magnitude !== undefined
                      ? `M ${selectedIncident.magnitude.toFixed(1)}`
                      : selectedIncident.category}
                  </strong>
                </div>
                <div>
                  <span>{selectedIncident.depthKm !== undefined ? 'DEPTH' : 'SOURCE'}</span>
                  <strong>
                    {selectedIncident.depthKm !== undefined
                      ? <>{selectedIncident.depthKm.toFixed(0)} <small>km</small></>
                      : selectedIncident.source ?? 'Demo'}
                  </strong>
                </div>
                <div>
                    <span>
                      {selectedIncident.category === 'earthquake'
                        ? 'FEED LEVEL'
                        : selectedIncident.source === 'NASA EONET'
                          ? 'SOURCE SEVERITY'
                          : 'ALERT LEVEL'}
                    </span>
                  <strong className={`severity-text severity-text-${selectedIncident.severity.toLowerCase()}`}>
                    {selectedIncident.source ? selectedIncident.severity : 'Demo'}
                  </strong>
                </div>
              </div>
              <div className="detail-foot">
                <span><CalendarDays size={13} /> {selectedIncident.timeLabel}</span>
                <span className="demo-data-note">
                  {selectedIncident.isDemo ? 'Synthetic demo' : `Official ${selectedIncident.source} data`}
                </span>
              </div>
              {selectedIncident.sourceUrl && (
                <a
                  className="event-open-button"
                  href={selectedIncident.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open official source <ArrowUpRight size={14} />
                </a>
              )}
              <button
                className="event-open-button"
                onClick={() => setSidebarOpen(true)}
                type="button"
              >
                View event in list <ArrowUpRight size={14} />
              </button>
            </div>
          )}

          <div className="map-legend">
            <span className="legend-heading">{dataMode === 'live' ? 'LIVE FEED TYPES' : 'DEMO EVENT TYPES'}</span>
            {dataMode === 'live' ? (
              <>
                <span><i className="legend-swatch earthquake" /> Earthquake</span>
                <span><i className="legend-swatch flood" /> Flood</span>
                <span><i className="legend-swatch landslide" /> Landslide</span>
                <span><i className="legend-swatch wildfire" /> Wildfire</span>
                <span><i className="legend-swatch storm" /> Severe storm</span>
                <span><i className="legend-swatch volcano" /> Volcano</span>
                <span><i className="legend-swatch drought" /> Drought</span>
                <span><i className="legend-swatch other" /> Other catalogued events</span>
                <span><i className="legend-swatch tsunami" /> Tsunami (U.S. alerts only)</span>
              </>
            ) : (
              <>
                <span><i className="legend-swatch flood" /> Flood</span>
                <span><i className="legend-swatch landslide" /> Landslide</span>
                <span><i className="legend-swatch earthquake" /> Ground movement</span>
              </>
            )}
          </div>

          <div className="timeline">
            <div className="timeline-header">
              <div>
                <span className="eyebrow">OBSERVATION WINDOW</span>
                <strong>Time range</strong>
              </div>
              <div className="range-selector" aria-label="Observation time range">
                {(['24h', '7d', '30d'] as const).map((range) => (
                  <button
                    aria-pressed={dateWindow === range}
                    className={dateWindow === range ? 'range-active' : ''}
                    key={range}
                    onClick={() => {
                      setVisibleEventCount(EVENT_PAGE_SIZE)
                      setDateWindow(range)
                    }}
                    type="button"
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <div className="timeline-track" aria-hidden="true">
              <span className="track-line" />
              <span className="track-progress" style={{ width: dateWindow === '24h' ? '10%' : dateWindow === '7d' ? '43%' : '92%' }} />
              {[0, 1, 2, 3, 4].map((step) => (
                <i className={`timeline-tick ${step < (dateWindow === '24h' ? 1 : dateWindow === '7d' ? 3 : 5) ? 'tick-active' : ''}`} key={step} />
              ))}
              <span className="timeline-now">NOW</span>
            </div>
            <div className="timeline-labels"><span>30 days ago</span><span>7 days ago</span><span>24 hours ago</span><span>Now</span></div>
          </div>

          <div className="map-disclaimer">
            <AlertTriangle size={13} />
            {dataMode === 'live'
              ? 'Monitoring only · Earthquakes cannot be predicted · Follow official local authorities'
              : 'Synthetic examples · Not real SAR detections or hazard alerts'}
          </div>

          <div className="date-chip">
            <CalendarDays size={13} />
            {dataMode === 'live' && feedUpdatedAt
              ? `Feed updated ${new Date(feedUpdatedAt).toLocaleTimeString()}`
              : dataMode === 'live'
                ? feedLoading ? 'Loading official feeds' : 'No feed update'
                : 'Synthetic sample set'}
          </div>
          {assistantOpen && (
            <AssistantPanel
              events={filteredIncidents}
              onClose={() => setAssistantOpen(false)}
              selectedIncident={selectedIncident}
            />
          )}
        </section>
      </section>
    </main>
  )
}

export default App
