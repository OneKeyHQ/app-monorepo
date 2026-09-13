// Executed by LavaMoat after repairIntrinsics and before hardenIntrinsics.
// This entry is bundled into a standalone script before LavaMoat reads it.
require('../../packages/shared/src/polyfills/webIntrinsics');

// Keep this in sync with warmUpLitSymbolMetadata in shared/sesHarden/runtime.
// Lit/AppKit may load lazily after Symbol has become non-extensible.
Symbol.metadata ??= Symbol('metadata');

// Core 18.0.5 exposes the initial value of writable globals without converting
// a package's receiver back to the host. Bind only these reviewed browser APIs
// before application wrappers capture them; later package replacements retain
// the core's existing write propagation and receiver behavior.
for (const name of ['fetch', 'requestAnimationFrame']) {
  // WorkerGlobalScope exposes fetch on its prototype instead of the global.
  let holder = globalThis;
  let descriptor;
  while (holder !== null && holder !== Object.prototype) {
    descriptor = Reflect.getOwnPropertyDescriptor(holder, name);
    if (descriptor) break;
    holder = Reflect.getPrototypeOf(holder);
  }
  if (descriptor?.writable && typeof descriptor.value === 'function') {
    Reflect.defineProperty(globalThis, name, {
      ...descriptor,
      value: descriptor.value.bind(globalThis),
    });
  }
}
