// Native ships a single bundle, so the lazy chunk buys nothing there and its
// Suspense fallback (null) is one of the reasons the home header network
// trigger paints later than its siblings on cold start (OK-61505). Resolve
// the trigger statically; web keeps the split chunk.
export { AllNetworksManagerTrigger as LazyAllNetworksManagerTrigger } from './AllNetworksManagerTrigger';
