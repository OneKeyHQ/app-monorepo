/**
 * Split bundle types (Phase 2)
 *
 * Defines the interfaces for the production split bundle system:
 * - Runtime bundle context (OTA vs builtin, bundle paths)
 * - Segment loading parameters
 * - Native loader interface
 * - Segment manifest structure
 * - Metadata v2 structure
 */

// ---------------------------------------------------------------------------
// Runtime & source kind
// ---------------------------------------------------------------------------

export type IRuntimeSourceKind = 'builtin' | 'ota';
export type IRuntimeKind = 'main' | 'background';
export type ISegmentRuntime = 'main' | 'background' | 'shared';

// ---------------------------------------------------------------------------
// Native loader interface (JS ↔ native bridge)
// ---------------------------------------------------------------------------

export type IRuntimeBundleContext = {
  runtimeKind: IRuntimeKind;
  sourceKind: IRuntimeSourceKind;
  /** Absolute path to the bundle root directory (OTA or builtin) */
  bundleRoot: string;
  /** iOS only: builtin asset root (same as bundleRoot for iOS) */
  builtinAssetRoot?: string;
  /** Android only: extract cache directory for builtin segments */
  builtinExtractRoot?: string;
  nativeVersion: string;
  bundleVersion?: string;
};

export type ILoadSegmentParams = {
  segmentId: number;
  segmentKey: string;
  relativePath: string;
  sha256: string;
};

export interface ISplitBundleNativeLoader {
  getRuntimeBundleContext(): Promise<IRuntimeBundleContext>;
  loadSegment(params: ILoadSegmentParams): Promise<void>;
}

// ---------------------------------------------------------------------------
// Segment manifest (embedded in JS bundle or loaded from metadata)
// ---------------------------------------------------------------------------

export type ISegmentManifestEntry = {
  /** Stable numeric ID for this segment */
  id: number;
  /** Logical segment key, e.g. "seg:feature.shared.wallet" */
  key: string;
  /** Which runtimes may load this segment */
  runtime: ISegmentRuntime;
  /** Relative path from bundle root, e.g. "segments/feature.shared.wallet.seg.hbc" */
  relativePath: string;
  /** SHA-256 hex digest for integrity */
  sha256: string;
  /** Segment keys this segment depends on (must be loaded first) */
  dependsOn: string[];
  /**
   * Override of `dependsOn` for the main runtime.
   *
   * Set on shared entries whose two runtimes' segment-level deps diverge:
   * the union (`dependsOn`) would point at segments that don't exist in the
   * loading runtime's view, and the loader would crash trying to preload
   * them. When present, the main runtime uses this list instead of
   * `dependsOn`. Absent on entries whose deps are identical across runtimes.
   */
  mainDependsOn?: string[];
  /** Same as `mainDependsOn` but for the background runtime. */
  backgroundDependsOn?: string[];
  /** If true, loading failure triggers degraded-mode recovery */
  critical?: boolean;
  /** Byte size of the .seg.hbc file */
  size?: number;
};

export type ISegmentManifestVariants = Partial<
  Record<ISegmentRuntime, ISegmentManifestEntry>
>;

export type ISegmentManifestVariantRecord = {
  /** Logical segment key, e.g. "seg:feature.shared.wallet" */
  key: string;
  /** Runtime-specific variants for the same logical segment key */
  variants: ISegmentManifestVariants;
};

export type ISegmentManifestRecord =
  | ISegmentManifestEntry
  | ISegmentManifestVariantRecord;

export type ISegmentManifest = {
  /** Map from segment key to a concrete entry or runtime-specific variants */
  segments: Record<string, ISegmentManifestRecord>;
};

// ---------------------------------------------------------------------------
// Metadata v2 (extends current metadata.json)
// ---------------------------------------------------------------------------

export type IMetadataV2 = {
  /** Schema version — 2 for split bundle */
  runtimeGraphVersion: 2;
  mainEntry: {
    file: string;
    sha256: string;
  };
  backgroundEntry: {
    file: string;
    sha256: string;
  };
  segments: Record<string, ISegmentManifestRecord>;
  /** Existing metadata fields preserved for backward compat */
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Loader state machine
// ---------------------------------------------------------------------------

export type ISegmentLoadState =
  | 'idle'
  | 'resolving'
  | 'registering'
  | 'ready'
  | 'failed';
