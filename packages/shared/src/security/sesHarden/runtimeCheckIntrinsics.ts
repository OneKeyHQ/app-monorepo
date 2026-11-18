// SES 2.3 universal/initial intrinsic roots shared by web and native. Optional
// engine capabilities remain explicit in the evidence rather than disappearing.
export const SES_INTRINSIC_ROOT_NAMES = [
  'ModuleSource',
  'HandledPromise',
  'harden',
  'lockdown',
  'Compartment',
  'eval',
  'isFinite',
  'isNaN',
  'parseFloat',
  'parseInt',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
  'escape',
  'unescape',
  'Object',
  'Function',
  'Array',
  'Promise',
  'Boolean',
  'String',
  'Number',
  'BigInt',
  'Symbol',
  'Date',
  'RegExp',
  'Error',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
  'AggregateError',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Proxy',
  'ArrayBuffer',
  'DataView',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float16Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
  'Iterator',
  'AsyncIterator',
  'Math',
  'JSON',
  'Reflect',
  'Temporal',
  'getStackString',
  'TextEncoder',
  'TextDecoder',
] as const;

export function collectSesIntrinsicLockEvidence() {
  const queue: [string, object][] = [];
  const seen = new WeakSet<object>();
  const missing: string[] = [];
  const mutable: string[] = [];
  let objects = 0;
  let functions = 0;
  const enqueue = (name: string, value: unknown) => {
    if (
      (typeof value === 'object' && value !== null) ||
      typeof value === 'function'
    )
      queue.push([name, value]);
  };
  for (const name of SES_INTRINSIC_ROOT_NAMES) {
    const value = (globalThis as unknown as Record<string, unknown>)[name];
    if (value === undefined) missing.push(name);
    else enqueue(name, value);
  }
  // These shared prototypes are not reachable through a global constructor.
  const asyncFunction = async () => undefined;
  function* generator() {
    yield 1;
  }
  async function* asyncGenerator() {
    yield 1;
  }
  enqueue('AsyncFunction.prototype', Object.getPrototypeOf(asyncFunction));
  enqueue('GeneratorFunction.prototype', Object.getPrototypeOf(generator));
  enqueue(
    'AsyncGeneratorFunction.prototype',
    Object.getPrototypeOf(asyncGenerator),
  );
  enqueue(
    'Generator.prototype',
    Object.getPrototypeOf(Object.getPrototypeOf(generator())),
  );
  enqueue(
    'AsyncGenerator.prototype',
    Object.getPrototypeOf(Object.getPrototypeOf(asyncGenerator())),
  );
  for (const [name, iterator] of [
    ['ArrayIterator', [][Symbol.iterator]()],
    ['StringIterator', ''[Symbol.iterator]()],
    ['MapIterator', new Map().entries()],
    ['SetIterator', new Set().values()],
  ] as const)
    enqueue(`${name}.prototype`, Object.getPrototypeOf(iterator));

  while (queue.length > 0) {
    const entry = queue.pop();
    if (!entry) break;
    const [name, value] = entry;
    if (!seen.has(value)) {
      seen.add(value);
      objects += 1;
      if (typeof value === 'function') functions += 1;
      if (!Object.isFrozen(value)) mutable.push(name);
      enqueue(`${name}.[[Prototype]]`, Object.getPrototypeOf(value));
      for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor) {
          // Inspect descriptors without invoking getters or mutating intrinsics.
          enqueue(`${name}.${String(key)}`, descriptor.value);
          enqueue(
            `${name}.${String(key)}.[[Get]]`,
            Reflect.get(descriptor, 'get') as unknown,
          );
          enqueue(
            `${name}.${String(key)}.[[Set]]`,
            Reflect.get(descriptor, 'set') as unknown,
          );
        }
      }
    }
  }
  return {
    roots: SES_INTRINSIC_ROOT_NAMES.length,
    objects,
    functions,
    missing,
    mutable,
  };
}
