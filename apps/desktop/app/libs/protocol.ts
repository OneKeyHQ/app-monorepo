// Custom scheme used to serve the renderer bundle via interceptFileProtocol.
// Module-scoped so softRestartRenderer and createMainWindow reference the SAME
// value — a divergence would make the pre-recreate uninterceptProtocol call
// silently no-op and reintroduce the stale-interceptor bug it exists to prevent.
export const PROTOCOL = 'file';
