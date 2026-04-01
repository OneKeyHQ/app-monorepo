/**
 * Segment utility functions (extracted from segmentSerializer.js)
 *
 * Pure-logic helpers for segment key derivation and ID allocation.
 * Used by both the serializer and unit tests.
 */

const path = require('path');

const monorepoRoot = path.resolve(__dirname, '../../..');

const SEGMENT_ID_BASE = 1000;

/**
 * Derive a readable segment key from an absolute module path.
 *
 * Examples:
 *   packages/kit-bg/src/services/ServiceSwap.ts → seg:kit-bg.services.ServiceSwap
 *   node_modules/ethers/lib/index.js            → seg:nm.ethers
 *   apps/mobile/src/App.tsx                     → seg:apps.mobile.src.App
 */
function deriveSegmentKey(absolutePath) {
  const rel = absolutePath
    .replace(monorepoRoot, '')
    .replace(/^\//, '')
    .replace(/\.(ts|tsx|js|jsx)$/, '');

  // packages/kit-bg/src/services/ServiceSwap → seg:kit-bg.services.ServiceSwap
  if (rel.startsWith('packages/')) {
    const parts = rel.replace('packages/', '').replace('/src/', '.').split('/');
    return `seg:${parts.join('.')}`;
  }

  // node_modules/some-lib → seg:nm.some-lib
  if (rel.includes('node_modules/')) {
    const afterNm = rel.split('node_modules/').pop();
    return `seg:nm.${afterNm.split('/')[0]}`;
  }

  // Default: use file path
  return `seg:${rel.replace(/\//g, '.')}`;
}

/**
 * Allocate stable numeric IDs to segment keys.
 * Keys are sorted alphabetically so IDs are deterministic across builds.
 */
function allocateSegmentIds(segmentKeys) {
  const sorted = [...segmentKeys].sort();
  const idMap = new Map();
  sorted.forEach((key, index) => {
    idMap.set(key, SEGMENT_ID_BASE + index);
  });
  return idMap;
}

module.exports = {
  monorepoRoot,
  SEGMENT_ID_BASE,
  deriveSegmentKey,
  allocateSegmentIds,
};
