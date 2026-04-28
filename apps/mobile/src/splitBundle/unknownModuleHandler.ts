/**
 * Classifier for "Requiring unknown module <id>" errors.
 *
 * These errors fire when Metro's runtime cannot resolve a numeric module id
 * — typically because a segment that should have been loaded was not (the
 * REACT-NATIVE-4AX failure mode: serializer regression, corrupt OTA, or
 * mismatched module-id-map).
 *
 * The classifier is deliberately strict (anchor at start of message) so it
 * doesn't false-positive on errors that merely include the substring (e.g.
 * a wrapped/forwarded error).
 *
 * (cross-ref) The integrity scanner at
 * apps/mobile/scripts/check-split-bundle-integrity.js and the loader
 * telemetry at apps/mobile/src/splitBundle/installProdBundleLoader.ts
 * (isMetroAsyncRequireUrl) are the upstream guards that should have
 * prevented us from ever getting here.
 */

const UNKNOWN_MODULE_PATTERN = /^Requiring unknown module ["']?(\d+)["']?/;

export type IUnknownModuleClassification = {
  kind: 'split_bundle_integrity';
  moduleId: string;
};

export function classifyUnknownModuleError(
  err: unknown,
): IUnknownModuleClassification | null {
  if (!(err instanceof Error)) return null;
  const m = UNKNOWN_MODULE_PATTERN.exec(err.message);
  if (!m) return null;
  return { kind: 'split_bundle_integrity', moduleId: m[1] };
}
