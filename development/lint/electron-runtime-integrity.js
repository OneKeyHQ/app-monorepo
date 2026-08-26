const PROTECTED_GLOBALS = [
  'AbortController',
  'AbortSignal',
  'Buffer',
  'Headers',
  'Request',
  'Response',
  'TextDecoder',
  'TextEncoder',
  'URL',
  'URLSearchParams',
  'clearImmediate',
  'clearInterval',
  'clearTimeout',
  'crypto',
  'fetch',
  'process',
  'queueMicrotask',
  'setImmediate',
  'setInterval',
  'setTimeout',
  'structuredClone',
];

const REQUIRED_BOOTSTRAP_MARKERS = [
  'captureNodeRuntimeBaseline',
  'repairProtectedNodeRuntime',
  'ONEKEY_NODE_RUNTIME_INTEGRITY_HARNESS_OUTPUT',
];

function isGuardedBufferFallback(source, match) {
  if (match[2] !== 'Buffer') return false;
  const objectName = match[1];
  const preceding = source.slice(Math.max(0, match.index - 200), match.index);
  const normalized = preceding.replace(/\s+/g, ' ').trimEnd();
  return (
    normalized.endsWith(`if (typeof ${objectName}.Buffer === "undefined") {`) ||
    normalized.endsWith(`if (typeof ${objectName}.Buffer === 'undefined') {`)
  );
}

function isCanonicalBufferRepair(source, match) {
  if (match[1] !== 'globalThis' || match[2] !== 'Buffer') return false;
  const preceding = source.slice(Math.max(0, match.index - 500), match.index);
  const functionStart = preceding.lastIndexOf('function ');
  return preceding
    .slice(functionStart)
    .includes('function repairProtectedNodeRuntime(');
}

function auditDesktopMainBundle(source) {
  const errors = [];
  for (const marker of REQUIRED_BOOTSTRAP_MARKERS) {
    if (!source.includes(marker)) {
      errors.push(`Missing Node runtime integrity bootstrap marker: ${marker}`);
    }
  }

  const protectedNames = PROTECTED_GLOBALS.join('|');
  const assignmentOperator = '(?:\\|\\|=|&&=|\\?\\?=|[+\\-*/%&|^]?=(?!=))';
  const assignmentPattern = new RegExp(
    `\\b(globalThis|global|globalScope)\\.(${protectedNames})\\s*${assignmentOperator}`,
    'g',
  );
  for (const match of source.matchAll(assignmentPattern)) {
    if (!isGuardedBufferFallback(source, match)) {
      errors.push(
        `Unprotected Electron main global write: ${match[1]}.${match[2]}`,
      );
    }
  }

  const bracketAssignmentPattern = new RegExp(
    `\\b(globalThis|global|globalScope)\\s*\\[\\s*["'](${protectedNames})["']\\s*\\]\\s*${assignmentOperator}`,
    'g',
  );
  for (const match of source.matchAll(bracketAssignmentPattern)) {
    errors.push(
      `Unprotected Electron main bracket global write: ${match[1]}[${match[2]}]`,
    );
  }

  const definePropertyPattern = new RegExp(
    `\\bObject\\.defineProperty\\(\\s*(globalThis|global|globalScope)\\s*,\\s*["'](${protectedNames})["']`,
    'g',
  );
  for (const match of source.matchAll(definePropertyPattern)) {
    if (!isCanonicalBufferRepair(source, match)) {
      errors.push(
        `Unprotected Electron main defineProperty write: ${match[1]}.${match[2]}`,
      );
    }
  }

  const reflectDefinePropertyPattern = new RegExp(
    `\\bReflect\\.defineProperty\\(\\s*(globalThis|global|globalScope)\\s*,\\s*["'](${protectedNames})["']`,
    'g',
  );
  for (const match of source.matchAll(reflectDefinePropertyPattern)) {
    errors.push(
      `Unprotected Electron main Reflect.defineProperty write: ${match[1]}.${match[2]}`,
    );
  }

  const definePropertiesPattern =
    /\bObject\.defineProperties\(\s*(globalThis|global|globalScope)\b/g;
  for (const match of source.matchAll(definePropertiesPattern)) {
    errors.push(
      `Unprotected Electron main defineProperties write: ${match[1]}`,
    );
  }

  const reflectSetPattern = new RegExp(
    `\\bReflect\\.set\\(\\s*(globalThis|global|globalScope)\\s*,\\s*["'](${protectedNames})["']`,
    'g',
  );
  for (const match of source.matchAll(reflectSetPattern)) {
    errors.push(
      `Unprotected Electron main Reflect.set write: ${match[1]}.${match[2]}`,
    );
  }

  const deletePattern = new RegExp(
    `\\bdelete\\s+(globalThis|global|globalScope)\\.(${protectedNames})\\b`,
    'g',
  );
  for (const match of source.matchAll(deletePattern)) {
    errors.push(
      `Unprotected Electron main global delete: ${match[1]}.${match[2]}`,
    );
  }

  const prototypeMutationPattern = new RegExp(
    `(^|[^\\w.])(Buffer|Uint8Array|Promise)\\.prototype\\.(slice|subarray|then|catch|finally)\\s*${assignmentOperator}`,
    'gm',
  );
  for (const match of source.matchAll(prototypeMutationPattern)) {
    errors.push(
      `Protected Electron main prototype mutation: ${match[2]}.prototype.${match[3]}`,
    );
  }

  const prototypeDefinePropertyPattern =
    /\bObject\.defineProperty\(\s*(Buffer|Uint8Array|Promise)\.prototype\s*,\s*["'](slice|subarray|then|catch|finally)["']/g;
  for (const match of source.matchAll(prototypeDefinePropertyPattern)) {
    errors.push(
      `Protected Electron main prototype defineProperty mutation: ${match[1]}.prototype.${match[2]}`,
    );
  }

  return errors;
}

module.exports = {
  PROTECTED_GLOBALS,
  auditDesktopMainBundle,
};
