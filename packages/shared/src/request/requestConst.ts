export const REQUEST_TIMEOUT = 30_000; // 60_000   30_000

/**
 * Set on fetch init objects whose request the axios interceptor already
 * counts for availability metrics (the extension service worker's XHR shim
 * sends axios requests through the patched global fetch).
 */
export const AVAILABILITY_COUNTED_FETCH_OPTION = '$oneKeyAvailabilityCounted';
