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

export type RuntimeSourceKind = 'builtin' | 'ota';
export type RuntimeKind = 'main' | 'background';
export type SegmentRuntime = 'main' | 'background' | 'shared';

// ---------------------------------------------------------------------------
// Native loader interface (JS ↔ native bridge)
// ---------------------------------------------------------------------------

export type RuntimeBundleContext = {
  runtimeKind: RuntimeKind;
  sourceKind: RuntimeSourceKind;
  /** Absolute path to the bundle root directory (OTA or builtin) */
  bundleRoot: string;
  /** iOS only: builtin asset root (same as bundleRoot for iOS) */
  builtinAssetRoot?: string;
  /** Android only: extract cache directory for builtin segments */
  builtinExtractRoot?: string;
  nativeVersion: string;
  bundleVersion?: string;
};

export type LoadSegmentParams = {
  segmentId: number;
  segmentKey: string;
  relativePath: string;
  sha256: string;
};

export interface ISplitBundleNativeLoader {
  getRuntimeBundleContext(): Promise<RuntimeBundleContext>;
  loadSegment(params: LoadSegmentParams): Promise<void>;
}

// ---------------------------------------------------------------------------
// Segment manifest (embedded in JS bundle or loaded from metadata)
// ---------------------------------------------------------------------------

export type SegmentManifestEntry = {
  /** Stable numeric ID for this segment */
  id: number;
  /** Logical segment key, e.g. "seg:feature.shared.wallet" */
  key: string;
  /** Which runtimes may load this segment */
  runtime: SegmentRuntime;
  /** Relative path from bundle root, e.g. "segments/feature.shared.wallet.seg.hbc" */
  relativePath: string;
  /** SHA-256 hex digest for integrity */
  sha256: string;
  /** Segment keys this segment depends on (must be loaded first) */
  dependsOn: string[];
  /** If true, loading failure triggers degraded-mode recovery */
  critical?: boolean;
  /** Byte size of the .seg.hbc file */
  size?: number;
};

export type SegmentManifestVariants = Partial<
  Record<SegmentRuntime, SegmentManifestEntry>
>;

export type SegmentManifestVariantRecord = {
  /** Logical segment key, e.g. "seg:feature.shared.wallet" */
  key: string;
  /** Runtime-specific variants for the same logical segment key */
  variants: SegmentManifestVariants;
};

export type SegmentManifestRecord =
  | SegmentManifestEntry
  | SegmentManifestVariantRecord;

export type SegmentManifest = {
  /** Map from segment key to a concrete entry or runtime-specific variants */
  segments: Record<string, SegmentManifestRecord>;
};

// ---------------------------------------------------------------------------
// Metadata v2 (extends current metadata.json)
// ---------------------------------------------------------------------------

export type MetadataV2 = {
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
  segments: Record<string, SegmentManifestRecord>;
  /** Existing metadata fields preserved for backward compat */
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Loader state machine
// ---------------------------------------------------------------------------

export type SegmentLoadState =
  | 'idle'
  | 'resolving'
  | 'registering'
  | 'ready'
  | 'failed';
