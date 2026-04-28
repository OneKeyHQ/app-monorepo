// apps/mobile/plugins/segmentSerializer.rewriteAsyncPaths.js
/**
 * Rewrite Metro's default async-require URL strings into stable production
 * segment keys (`seg:<key>`).
 *
 * Why this is a separate file: the rewrite must run identically on the main
 * bundle's modules AND on every segment's modules. Keeping it inline in
 * segmentSerializer made it trivially easy to forget the segment side
 * (which is exactly the regression that crashed iOS 6.3.0+10069276 OTA).
 *
 * Contract:
 *   - Mutates `modules` in place. Each entry is `[moduleId, codeString]`.
 *   - For every (asyncModuleId, segKey) in moduleToSegment, replaces
 *     `,"<id>":"<anything>"` and `{"<id>":"<anything>"` with
 *     `,"<id>":"<segKey>"` / `{"<id>":"<segKey>"`.
 *   - Idempotent: rewriting an already-rewritten module is a no-op.
 */
// (cross-ref) Same Metro async-require URL shape is detected at build time
// by apps/mobile/scripts/check-split-bundle-integrity.js (UNREWRITTEN_ASYNC_PATH)
// and at runtime by apps/mobile/src/splitBundle/installProdBundleLoader.ts
// (isMetroAsyncRequireUrl). All three must change together if Metro
// updates its async-require URL convention.
function buildRewritePattern(moduleToSegment) {
  const ids = [...moduleToSegment.keys()];
  if (ids.length === 0) return null;
  const idAlternation = ids.map(String).join('|');
  // Group 1: prefix `{` or `,` (preserved verbatim).
  // Group 2: the numeric module id (used to look up the seg key).
  // Group 3: the colon and surrounding whitespace (preserved verbatim).
  // Trailing "(?:[^"\\]|\\.)*" tolerates escaped chars inside the URL value
  // — without this, a value like "/x/\"y\"/z.bundle" would tear and emit
  // invalid JS that Hermes would refuse to parse.
  return new RegExp(
    `([{,]\\s*)"(${idAlternation})"(\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`,
    'g',
  );
}

function rewriteAsyncPathsInModules(modules, moduleToSegment) {
  const pattern = buildRewritePattern(moduleToSegment);
  if (!pattern) return;
  modules.forEach((mod) => {
    if (!mod || typeof mod[1] !== 'string') return;
    mod[1] = mod[1].replace(pattern, (match, prefix, modId, colon) => {
      const segKey = moduleToSegment.get(Number(modId));
      return segKey ? `${prefix}"${modId}"${colon}"${segKey}"` : match;
    });
  });
}

module.exports = { buildRewritePattern, rewriteAsyncPathsInModules };
