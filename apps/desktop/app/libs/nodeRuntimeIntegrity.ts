import { Buffer as NativeBuffer } from 'node:buffer';
import * as nodeCrypto from 'node:crypto';
import * as nodeFs from 'node:fs';
import * as nodeModule from 'node:module';
import nodeProcess from 'node:process';
import * as nodeTimers from 'node:timers';
import {
  URL as NodeURL,
  URLSearchParams as NodeURLSearchParams,
} from 'node:url';
import {
  TextDecoder as NodeTextDecoder,
  TextEncoder as NodeTextEncoder,
} from 'node:util';

type TValueGetter = () => unknown;

interface IRuntimeCheck {
  getValue: TValueGetter;
  name: string;
}

export interface INodeRuntimeBaseline {
  bufferDescriptor: PropertyDescriptor | undefined;
  values: ReadonlyMap<string, unknown>;
}

export interface INodeRuntimeDrift {
  name: string;
}

export interface INodeRuntimeRepair {
  name: string;
}

const getGlobalValue = (name: string): unknown => Reflect.get(globalThis, name);

const getObjectValue = (target: object, name: PropertyKey): unknown =>
  Reflect.get(target, name);

const runtimeChecks = (): IRuntimeCheck[] => [
  { name: 'global.Buffer', getValue: () => getGlobalValue('Buffer') },
  { name: 'global.process', getValue: () => getGlobalValue('process') },
  { name: 'global.crypto', getValue: () => getGlobalValue('crypto') },
  {
    name: 'global.TextEncoder',
    getValue: () => getGlobalValue('TextEncoder'),
  },
  {
    name: 'global.TextDecoder',
    getValue: () => getGlobalValue('TextDecoder'),
  },
  { name: 'global.URL', getValue: () => getGlobalValue('URL') },
  {
    name: 'global.URLSearchParams',
    getValue: () => getGlobalValue('URLSearchParams'),
  },
  {
    name: 'global.setImmediate',
    getValue: () => getGlobalValue('setImmediate'),
  },
  {
    name: 'global.clearImmediate',
    getValue: () => getGlobalValue('clearImmediate'),
  },
  { name: 'global.setTimeout', getValue: () => getGlobalValue('setTimeout') },
  {
    name: 'global.clearTimeout',
    getValue: () => getGlobalValue('clearTimeout'),
  },
  {
    name: 'global.setInterval',
    getValue: () => getGlobalValue('setInterval'),
  },
  {
    name: 'global.clearInterval',
    getValue: () => getGlobalValue('clearInterval'),
  },
  {
    name: 'global.queueMicrotask',
    getValue: () => getGlobalValue('queueMicrotask'),
  },
  {
    name: 'global.structuredClone',
    getValue: () => getGlobalValue('structuredClone'),
  },
  { name: 'global.fetch', getValue: () => getGlobalValue('fetch') },
  { name: 'global.Headers', getValue: () => getGlobalValue('Headers') },
  { name: 'global.Request', getValue: () => getGlobalValue('Request') },
  { name: 'global.Response', getValue: () => getGlobalValue('Response') },
  {
    name: 'global.AbortController',
    getValue: () => getGlobalValue('AbortController'),
  },
  {
    name: 'global.AbortSignal',
    getValue: () => getGlobalValue('AbortSignal'),
  },
  {
    name: 'Buffer.prototype.slice',
    getValue: () => getObjectValue(NativeBuffer.prototype, 'slice'),
  },
  {
    name: 'Buffer.prototype.subarray',
    getValue: () => getObjectValue(NativeBuffer.prototype, 'subarray'),
  },
  {
    name: 'Uint8Array.prototype.slice',
    getValue: () => getObjectValue(Uint8Array.prototype, 'slice'),
  },
  {
    name: 'Uint8Array.prototype.subarray',
    getValue: () => getObjectValue(Uint8Array.prototype, 'subarray'),
  },
  {
    name: 'Promise.prototype.then',
    getValue: () => getObjectValue(Promise.prototype, 'then'),
  },
  {
    name: 'Promise.prototype.catch',
    getValue: () => getObjectValue(Promise.prototype, 'catch'),
  },
  {
    name: 'Promise.prototype.finally',
    getValue: () => getObjectValue(Promise.prototype, 'finally'),
  },
  { name: 'node:crypto.randomBytes', getValue: () => nodeCrypto.randomBytes },
  { name: 'node:crypto.randomUUID', getValue: () => nodeCrypto.randomUUID },
  { name: 'node:crypto.createHash', getValue: () => nodeCrypto.createHash },
  { name: 'node:fs.readFile', getValue: () => nodeFs.readFile },
  { name: 'node:fs.readFileSync', getValue: () => nodeFs.readFileSync },
  { name: 'node:fs.writeFile', getValue: () => nodeFs.writeFile },
  { name: 'node:fs.writeFileSync', getValue: () => nodeFs.writeFileSync },
  {
    name: 'node:fs.promises.readFile',
    getValue: () => nodeFs.promises.readFile,
  },
  {
    name: 'node:module.createRequire',
    getValue: () => nodeModule.createRequire,
  },
];

const canonicalNodeGlobalChecks = (): Array<
  [name: string, current: unknown, expected: unknown]
> => [
  ['global.Buffer', getGlobalValue('Buffer'), NativeBuffer],
  ['global.process', getGlobalValue('process'), nodeProcess],
  ['global.TextEncoder', getGlobalValue('TextEncoder'), NodeTextEncoder],
  ['global.TextDecoder', getGlobalValue('TextDecoder'), NodeTextDecoder],
  ['global.URL', getGlobalValue('URL'), NodeURL],
  [
    'global.URLSearchParams',
    getGlobalValue('URLSearchParams'),
    NodeURLSearchParams,
  ],
  [
    'global.setImmediate',
    getGlobalValue('setImmediate'),
    nodeTimers.setImmediate,
  ],
  [
    'global.clearImmediate',
    getGlobalValue('clearImmediate'),
    nodeTimers.clearImmediate,
  ],
];

export function getNodeRuntimeCheckNames(): string[] {
  return runtimeChecks().map(({ name }) => name);
}

export function getCanonicalNodeGlobalCheckNames(): string[] {
  return canonicalNodeGlobalChecks().map(([name]) => name);
}

export function captureNodeRuntimeBaseline(): INodeRuntimeBaseline {
  return {
    bufferDescriptor: Object.getOwnPropertyDescriptor(globalThis, 'Buffer'),
    values: new Map(
      runtimeChecks().map(({ getValue, name }) => [name, getValue()]),
    ),
  };
}

export function auditNodeRuntime(
  baseline: INodeRuntimeBaseline,
): INodeRuntimeDrift[] {
  return runtimeChecks().flatMap(({ getValue, name }) =>
    Object.is(baseline.values.get(name), getValue()) ? [] : [{ name }],
  );
}

export function auditCanonicalNodeGlobals(): INodeRuntimeDrift[] {
  return canonicalNodeGlobalChecks().flatMap(([name, current, expected]) =>
    Object.is(current, expected) ? [] : [{ name }],
  );
}

export function repairProtectedNodeRuntime(
  baseline: INodeRuntimeBaseline,
): INodeRuntimeRepair[] {
  if (Object.is(getGlobalValue('Buffer'), NativeBuffer)) {
    return [];
  }

  const descriptor = baseline.bufferDescriptor;
  Object.defineProperty(globalThis, 'Buffer', {
    configurable: descriptor?.configurable ?? true,
    enumerable: descriptor?.enumerable ?? false,
    value: NativeBuffer,
    writable: descriptor?.writable ?? true,
  });

  return [{ name: 'global.Buffer' }];
}
