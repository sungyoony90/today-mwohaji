// Only non-content, non-location metadata is permitted across the SDK boundary.
const allowed = new Set([
  'occurred_at', 'session_id', 'app_version', 'screen', 'transport_mode',
  'spot_id', 'result_position', 'card_surface', 'selection_surface', 'link_surface',
  'theme_id', 'total_cards', 'verification_type', 'related_spots_available',
  'activity', 'result_count', 'place_type', 'visibility', 'has_reflection',
  'photo_source', 'method', 'failure_reason', 'state_key', 'empty_type',
  'interest', 'companion', 'selected_region', 'error_type', 'already_collected',
  'region_confirmed', 'location_source', 'step',
]);
const types = new Set(['debug','info','warn','error','event','screen','impression','click','popup']);
export function toTossAnalyticsPayload(event) {
  if (!event || typeof event.event_name !== 'string' || !/^[a-z][a-z0-9_]{0,79}$/.test(event.event_name)) return null;
  const params = {};
  for (const [key, value] of Object.entries(event)) {
    if (!allowed.has(key) || value == null) continue;
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) params[key] = value;
    else if (typeof value === 'string' && value.length <= 160) params[key] = value;
  }
  return { log_name: event.event_name, log_type: types.has(event.log_type) ? event.log_type : 'event', params };
}

export function deliverAnalytics(log, event) {
  const payload = toTossAnalyticsPayload(event);
  if (!payload) return;
  // Analytics must never interrupt navigation, including synchronous SDK errors.
  void Promise.resolve().then(() => log(payload)).catch(() => {});
}
