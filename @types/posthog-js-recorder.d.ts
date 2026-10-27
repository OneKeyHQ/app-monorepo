// cspell:ignore rrweb
// posthog-js ships no typings for this bundle. It is imported only for its
// side effect: registering the rrweb recorder on window.__PosthogExtensions__
// so the SDK never loads lazy-recorder.js.
declare module 'posthog-js/dist/posthog-recorder' {
  const record: unknown;
  export default record;
}
