import { createFetchInterceptor } from './createFetchInterceptor';

const newFetch = createFetchInterceptor();
Reflect.defineProperty(newFetch, 'isNormalizedByOneKey', {
  configurable: false,
  enumerable: false,
  value: true,
  writable: false,
});
console.log('fetchInterceptor.ts', fetch);
if (
  globalThis.fetch &&
  // @ts-ignore
  !globalThis.fetch.isNormalizedByOneKey
) {
  // **** for global instance of fetch
  globalThis.fetch = newFetch;
}
