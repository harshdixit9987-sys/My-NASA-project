import type { Incident } from './data/incidents'

export function getAssistantReply(
  question: string,
  selectedIncident: Incident | null,
  events: Incident[],
): string {
  const prompt = question.toLocaleLowerCase()

  if (/predict|prediction|aane vala|aane wali|when.*earthquake|where.*earthquake/.test(prompt)) {
    return 'No reliable system can tell exactly where or when an earthquake will happen, and this map does not predict earthquakes. It shows reports after they are detected and official alerts when a provider issues them. Please follow local emergency-management guidance.'
  }

  if (/what should i do|what do i do|emergency|help me|kya karu|kya karna/.test(prompt)) {
    return 'This dashboard combines global natural-event reports and some official feeds, but it does not cover every emergency or replace local emergency alerts. For immediate safety decisions, follow local authorities and official emergency guidance.'
  }

  if (/\bsar\b|radar|synthetic aperture|nisar/.test(prompt)) {
    return 'SAR means Synthetic Aperture Radar. Unlike optical imagery, radar can collect observations at night and through clouds. Comparing radar acquisitions can help identify surface changes, but interpreting them requires real, calibrated satellite products and local context. This prototype does not process NISAR data.'
  }

  if (/tsunami|flood alert|warning/.test(prompt)) {
    const matches = events.filter((event) =>
      /tsunami|flood/.test(event.category),
    )
    if (matches.length === 0) {
      return 'There are no matching flood or tsunami reports in the current filtered view. This does not mean there is no danger: NASA EONET is a curated event catalog, and NOAA/NWS alerts here are U.S.-focused, not worldwide. Check your local official warning agency.'
    }

    return `The current view contains ${matches.length} flood or tsunami report${matches.length === 1 ? '' : 's'}:\n\n${matches
      .slice(0, 5)
      .map((event) => `• ${event.name} — ${event.region}`)
      .join('\n')}\n\nNASA EONET flood reports are catalog entries, not necessarily official warnings; NOAA/NWS alerts here are U.S.-only. This is not a worldwide warning service. Open the linked source and follow local authorities.`
  }

  if (/summari|overview|compare|all event|visible event|kitne|sabhi event/.test(prompt)) {
    if (events.length === 0) {
      return 'There are no reports in the current filtered view. This does not confirm that no emergency exists; adjust the filters and check local official sources.'
    }

    const earthquakes = events.filter((event) => event.category === 'earthquake').length
    const tsunamiAlerts = events.filter((event) => event.category === 'tsunami').length
    const floodAlerts = events.filter((event) => event.category === 'flood').length
    const eventLines = events
      .slice(0, 4)
      .map((event) =>
        `• ${event.name} — ${event.region}, ${event.country}${event.magnitude === undefined ? '' : ` (M ${event.magnitude.toFixed(1)})`}`,
      )
      .join('\n')

    if (events.every((event) => event.isDemo)) {
      return `The map contains ${events.length} illustrative sample event${events.length === 1 ? '' : 's'}: ${eventLines}\n\nThese are synthetic examples, not verified observations.`
    }

    return `The current filtered view shows ${events.length} reports: ${earthquakes} USGS earthquake${earthquakes === 1 ? '' : 's'}, ${tsunamiAlerts} tsunami alert${tsunamiAlerts === 1 ? '' : 's'}, and ${floodAlerts} flood report${floodAlerts === 1 ? '' : 's'} among the connected sources.\n\n${eventLines}${events.length > 4 ? '\n• More reports are available in the event list.' : ''}\n\nNASA EONET is a curated natural-event catalog and may not list every emergency or provide immediate warnings. NOAA alerts here cover the United States only. Earthquake reports describe events already detected, not predictions. Follow local authorities.`
  }

  if (/confiden|confidence|accuracy|reliable|bharosa/.test(prompt)) {
    if (selectedIncident && !selectedIncident.isDemo) {
      return `This event is reported by ${selectedIncident.source ?? 'an official feed'}; this dashboard does not calculate a predictive confidence score. For an earthquake, magnitude and depth are measurements from the source, not a forecast of future shaking or damage.`
    }
    if (selectedIncident) {
      return `The selected sample shows ${selectedIncident.confidence}% confidence. In this demo, that number is illustrative only—it is not a measured model score or an accuracy guarantee. Real confidence requires a documented method, validation data, and observation quality information.`
    }
    return 'Confidence is an estimate of how strongly an analysis supports a detection; it is not the same as accuracy. These demo scores are illustrative and are not calculated from satellite data.'
  }

  if (selectedIncident) {
    if (!selectedIncident.isDemo) {
      if (selectedIncident.magnitude !== undefined) {
        return `USGS reports a magnitude ${selectedIncident.magnitude.toFixed(1)} earthquake ${selectedIncident.region}, ${selectedIncident.country}, ${selectedIncident.timeLabel}${selectedIncident.depthKm === undefined ? '' : `, at a depth of ${selectedIncident.depthKm.toFixed(0)} km`}. Magnitude and depth describe a reported event; they do not predict another earthquake or tell the expected local damage. Check the linked USGS event page for updates.`
      }

      return `${selectedIncident.source ?? 'A connected provider'} reports ${selectedIncident.name} (${selectedIncident.category}) at ${selectedIncident.region}. This feed's severity is ${selectedIncident.severity === 'Unknown' ? 'not provided' : selectedIncident.severity}; this report is not a complete emergency warning. Check the linked source and follow local authorities.`
    }

    return `The selected sample is “${selectedIncident.name}” near ${selectedIncident.region}, ${selectedIncident.country}. It is labelled ${selectedIncident.category}, with an illustrative ${selectedIncident.severity.toLowerCase()} severity, ${selectedIncident.areaKm2} km² area, and ${selectedIncident.confidence}% confidence. These values are mock data—not a real SAR detection or a risk assessment.`
  }

  return 'I can explain SAR basics, summarize current official reports, or describe a selected event. No reliable system can predict the exact time and place of earthquakes. This prototype does not derive flood or landslide detection from SAR imagery. Select a listed report or check the official sources.'
}
