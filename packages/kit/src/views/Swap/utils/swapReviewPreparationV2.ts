import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import { SWAP_REVIEW_PREPARATION_CAPABILITY_VERSION } from '@onekeyhq/shared/types/swap/types';
import type {
  ESwapReviewPreparationOutputKind,
  ISwapReviewPreparationArtifact,
  ISwapReviewPreparationCapability,
  ISwapReviewPreparationDeclaration,
  ISwapReviewSession,
  ISwapReviewSessionIdentityFields,
} from '@onekeyhq/shared/types/swap/types';

const UNSAFE_PREPARATION_OUTPUT_KINDS: ReadonlySet<ESwapReviewPreparationOutputKind> =
  new Set(['signedOrder', 'depositOrder', 'depositChannel']);

const SAFE_PREPARATION_OUTPUT_KINDS: readonly ESwapReviewPreparationOutputKind[] =
  ['rawTx', 'utxo', 'cell', 'objectTx', 'wrapped'];

export type ICreateSwapReviewSessionParams = {
  sessionId: string;
  revision?: number;
  identity: ISwapReviewSessionIdentityFields;
};

export function buildSwapReviewSessionFingerprint(
  identity: ISwapReviewSession,
): string {
  const {
    sessionId: _sessionId,
    revision: _revision,
    ...identityFields
  } = identity;
  return stableStringify(identityFields);
}

export function createSwapReviewSession({
  sessionId,
  revision = 0,
  identity,
}: ICreateSwapReviewSessionParams): ISwapReviewSession {
  return {
    ...identity,
    sessionId,
    revision,
  };
}

export function advanceSwapReviewSession({
  current,
  identity,
}: {
  current: ISwapReviewSession;
  identity: ISwapReviewSessionIdentityFields;
}): ISwapReviewSession {
  const next = createSwapReviewSession({
    sessionId: current.sessionId,
    revision: current.revision,
    identity,
  });

  if (
    buildSwapReviewSessionFingerprint(current) ===
    buildSwapReviewSessionFingerprint(next)
  ) {
    return current;
  }

  return {
    ...next,
    revision: current.revision + 1,
  };
}

function buildConfirmOnlyCapability({
  implementation,
  provider,
  outputKind = 'unknown',
  reason,
}: {
  implementation: string;
  provider?: string;
  outputKind?: ESwapReviewPreparationOutputKind;
  reason: ISwapReviewPreparationCapability['reason'];
}): ISwapReviewPreparationCapability {
  return {
    implementation:
      typeof implementation === 'string' ? implementation : 'unknown',
    provider,
    outputKind,
    preparationMode: 'confirmOnly',
    canPrepareBeforeReview: false,
    canReuseEncodedTx: false,
    requiresFreshBuildAtConfirm: true,
    requiresFreshFeeAtConfirm: true,
    requiresFreshNonceOrSequence: true,
    requiresFreshBlockOrLedger: true,
    requiresFreshUtxoOrObject: true,
    requiresFreshResourceState: true,
    createsOneKeyOrder: false,
    createsThirdPartyOrder: false,
    createsDepositAddressOrChannel: false,
    reason,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidPreparationMode(
  mode: unknown,
): mode is ISwapReviewPreparationDeclaration['mode'] {
  return mode === 'readOnlyPrebuild' || mode === 'serverPrepare';
}

function isValidPreparationOutputKind(
  outputKind: unknown,
): outputKind is ESwapReviewPreparationOutputKind {
  return (
    outputKind === 'rawTx' ||
    outputKind === 'utxo' ||
    outputKind === 'cell' ||
    outputKind === 'objectTx' ||
    outputKind === 'signedOrder' ||
    outputKind === 'depositOrder' ||
    outputKind === 'depositChannel' ||
    outputKind === 'wrapped' ||
    outputKind === 'unknown'
  );
}

function isSafePreparationOutputKind(
  outputKind: unknown,
): outputKind is Exclude<ESwapReviewPreparationOutputKind, 'unknown'> {
  return SAFE_PREPARATION_OUTPUT_KINDS.some((kind) => kind === outputKind);
}

function isBooleanOrUndefined(value: unknown): value is boolean | undefined {
  return typeof value === 'undefined' || typeof value === 'boolean';
}

function isValidDuration(value: unknown): value is number | undefined {
  return (
    typeof value === 'undefined' ||
    (typeof value === 'number' && Number.isFinite(value) && value >= 0)
  );
}

function isValidPreparationDeclaration(
  value: unknown,
): value is ISwapReviewPreparationDeclaration {
  if (!isRecord(value)) {
    return false;
  }

  const requiredBooleans = [
    value.safeBeforeReview,
    value.sideEffectFree,
    value.canReuseEncodedTx,
  ];
  const optionalBooleans = [
    value.requiresFreshBuildAtConfirm,
    value.requiresFreshFeeAtConfirm,
    value.requiresFreshNonceOrSequence,
    value.requiresFreshBlockOrLedger,
    value.requiresFreshUtxoOrObject,
    value.requiresFreshResourceState,
    value.createsOneKeyOrder,
    value.createsThirdPartyOrder,
    value.createsDepositAddressOrChannel,
  ];

  return (
    value.version === SWAP_REVIEW_PREPARATION_CAPABILITY_VERSION &&
    isValidPreparationMode(value.mode) &&
    isValidPreparationOutputKind(value.outputKind) &&
    value.outputKind !== 'unknown' &&
    requiredBooleans.every((item) => typeof item === 'boolean') &&
    optionalBooleans.every(isBooleanOrUndefined) &&
    isValidDuration(value.expiresInMs) &&
    isValidDuration(value.reusableUntilMs)
  );
}

export function resolveSwapReviewPreparationCapability({
  declaration,
  implementation = 'unknown',
  provider,
}: {
  declaration?: ISwapReviewPreparationDeclaration;
  implementation?: string;
  provider?: string;
}): ISwapReviewPreparationCapability {
  const safeImplementation =
    typeof implementation === 'string' ? implementation : 'unknown';

  if (!declaration) {
    return buildConfirmOnlyCapability({
      implementation: safeImplementation,
      provider,
      reason: 'missing-contract',
    });
  }

  const declarationOutputKind = isRecord(declaration)
    ? declaration.outputKind
    : undefined;
  const outputKind = isValidPreparationOutputKind(declarationOutputKind)
    ? declarationOutputKind
    : 'unknown';

  if (!isValidPreparationDeclaration(declaration)) {
    return buildConfirmOnlyCapability({
      implementation: safeImplementation,
      provider,
      outputKind,
      reason: 'invalid-contract',
    });
  }

  if (UNSAFE_PREPARATION_OUTPUT_KINDS.has(declaration.outputKind)) {
    return buildConfirmOnlyCapability({
      implementation: safeImplementation,
      provider,
      outputKind: declaration.outputKind,
      reason: 'unsafe-output',
    });
  }

  if (!isSafePreparationOutputKind(declaration.outputKind)) {
    return buildConfirmOnlyCapability({
      implementation: safeImplementation,
      provider,
      outputKind: declaration.outputKind,
      reason: 'invalid-contract',
    });
  }

  if (declaration.mode === 'serverPrepare') {
    return buildConfirmOnlyCapability({
      implementation: safeImplementation,
      provider,
      outputKind: declaration.outputKind,
      reason: 'missing-prepare-contract',
    });
  }

  const normalizedImplementation = safeImplementation.trim();
  if (
    normalizedImplementation.length === 0 ||
    normalizedImplementation === 'unknown' ||
    normalizedImplementation === 'unavailable'
  ) {
    return buildConfirmOnlyCapability({
      implementation: safeImplementation,
      provider,
      outputKind: declaration.outputKind,
      reason: 'missing-implementation',
    });
  }

  const createsOneKeyOrder = Boolean(declaration.createsOneKeyOrder);
  const createsThirdPartyOrder = Boolean(declaration.createsThirdPartyOrder);
  const createsDepositAddressOrChannel = Boolean(
    declaration.createsDepositAddressOrChannel,
  );
  if (
    !declaration.safeBeforeReview ||
    !declaration.sideEffectFree ||
    createsOneKeyOrder ||
    createsThirdPartyOrder ||
    createsDepositAddressOrChannel
  ) {
    return buildConfirmOnlyCapability({
      implementation: safeImplementation,
      provider,
      outputKind: declaration.outputKind,
      reason: 'side-effectful-contract',
    });
  }

  const requiresFreshNonceOrSequence = Boolean(
    declaration.requiresFreshNonceOrSequence,
  );
  const requiresFreshBlockOrLedger = Boolean(
    declaration.requiresFreshBlockOrLedger,
  );
  const requiresFreshUtxoOrObject = Boolean(
    declaration.requiresFreshUtxoOrObject,
  );
  const requiresFreshResourceState = Boolean(
    declaration.requiresFreshResourceState,
  );
  const requiresFreshBuildAtConfirm =
    declaration.requiresFreshBuildAtConfirm !== false;
  const requiresFreshFeeAtConfirm =
    declaration.requiresFreshFeeAtConfirm !== false;

  return {
    implementation: safeImplementation,
    provider,
    outputKind: declaration.outputKind,
    preparationMode: declaration.mode,
    canPrepareBeforeReview: true,
    canReuseEncodedTx:
      declaration.canReuseEncodedTx &&
      !requiresFreshBuildAtConfirm &&
      !requiresFreshNonceOrSequence &&
      !requiresFreshBlockOrLedger &&
      !requiresFreshUtxoOrObject &&
      !requiresFreshResourceState,
    requiresFreshBuildAtConfirm,
    requiresFreshFeeAtConfirm,
    requiresFreshNonceOrSequence,
    requiresFreshBlockOrLedger,
    requiresFreshUtxoOrObject,
    requiresFreshResourceState,
    createsOneKeyOrder,
    createsThirdPartyOrder,
    createsDepositAddressOrChannel,
    expiresInMs: declaration.expiresInMs,
    reusableUntilMs: declaration.reusableUntilMs,
    reason: 'explicit-contract',
  };
}

export function canRebuildSwapReviewBeforeConfirm({
  requiresSlippageRebuildOnConfirm,
  capability,
}: {
  requiresSlippageRebuildOnConfirm?: boolean;
  capability?: ISwapReviewPreparationCapability;
}): boolean {
  return Boolean(
    requiresSlippageRebuildOnConfirm === true &&
    capability?.preparationMode !== 'confirmOnly' &&
    capability?.canPrepareBeforeReview === true &&
    capability.canReuseEncodedTx === true &&
    capability.requiresFreshBuildAtConfirm === false &&
    capability.requiresFreshFeeAtConfirm === false,
  );
}

function addDuration(createdAt: number, duration?: number): number | undefined {
  if (
    typeof duration !== 'number' ||
    !Number.isFinite(duration) ||
    duration < 0
  ) {
    return undefined;
  }
  return createdAt + duration;
}

export function createSwapReviewPreparationArtifact({
  identity,
  capability,
  artifactId,
  createdAt,
  freshnessFingerprint,
}: {
  identity: ISwapReviewSession;
  capability: ISwapReviewPreparationCapability;
  artifactId: string;
  createdAt: number;
  freshnessFingerprint?: string;
}): ISwapReviewPreparationArtifact | undefined {
  if (
    !capability.canPrepareBeforeReview ||
    capability.preparationMode === 'confirmOnly' ||
    capability.outputKind === 'unknown'
  ) {
    return undefined;
  }

  const expiresAt = addDuration(createdAt, capability.expiresInMs);
  const reusableUntil = addDuration(createdAt, capability.reusableUntilMs);

  return {
    sessionId: identity.sessionId,
    revision: identity.revision,
    identityFingerprint: buildSwapReviewSessionFingerprint(identity),
    artifactId,
    preparationMode: capability.preparationMode,
    outputKind: capability.outputKind,
    createdAt,
    expiresAt,
    reusableUntil,
    requiresFreshBuildAtConfirm: capability.requiresFreshBuildAtConfirm,
    requiresFreshFeeAtConfirm: capability.requiresFreshFeeAtConfirm,
    freshnessFingerprint,
  };
}

export function isSwapReviewPreparationArtifactCurrent({
  artifact,
  identity,
  now,
  freshnessFingerprint,
}: {
  artifact?: ISwapReviewPreparationArtifact;
  identity: ISwapReviewSession;
  now: number;
  freshnessFingerprint?: string;
}): boolean {
  if (!artifact) {
    return false;
  }
  if (
    artifact.sessionId !== identity.sessionId ||
    artifact.revision !== identity.revision ||
    artifact.identityFingerprint !== buildSwapReviewSessionFingerprint(identity)
  ) {
    return false;
  }
  if (typeof artifact.expiresAt === 'number' && now >= artifact.expiresAt) {
    return false;
  }
  if (
    typeof artifact.freshnessFingerprint !== 'string' ||
    artifact.freshnessFingerprint.length === 0 ||
    typeof freshnessFingerprint !== 'string' ||
    freshnessFingerprint.length === 0
  ) {
    return false;
  }
  return artifact.freshnessFingerprint === freshnessFingerprint;
}

export function buildSwapReviewPreparationFreshnessFingerprint({
  encodedTx,
  transferInfo,
}: {
  encodedTx?: unknown;
  transferInfo?: unknown;
}): string | undefined {
  if (typeof encodedTx === 'undefined') {
    return undefined;
  }

  return stableStringify({
    encodedTx,
    transferInfo: transferInfo ?? null,
  });
}

export function canReuseSwapReviewPreparationArtifact({
  artifact,
  identity,
  now,
  freshnessFingerprint,
}: {
  artifact?: ISwapReviewPreparationArtifact;
  identity: ISwapReviewSession;
  now: number;
  freshnessFingerprint?: string;
}): boolean {
  if (
    !isSwapReviewPreparationArtifactCurrent({
      artifact,
      identity,
      now,
      freshnessFingerprint,
    }) ||
    artifact?.requiresFreshBuildAtConfirm !== false ||
    artifact.requiresFreshFeeAtConfirm !== false
  ) {
    return false;
  }

  return (
    typeof artifact.reusableUntil !== 'number' || now < artifact.reusableUntil
  );
}

export function canReuseSwapReviewPreparedBuild({
  artifact,
  capability,
  identity,
  now,
  freshnessFingerprint,
  encodedTx,
  sideEffectsCommitted,
}: {
  artifact?: ISwapReviewPreparationArtifact;
  capability?: ISwapReviewPreparationCapability;
  identity?: ISwapReviewSession;
  now: number;
  freshnessFingerprint?: string;
  encodedTx?: unknown;
  sideEffectsCommitted?: boolean;
}): boolean {
  if (
    !identity ||
    !capability ||
    !capability.canReuseEncodedTx ||
    capability.preparationMode === 'confirmOnly' ||
    capability.outputKind === 'unknown' ||
    capability.requiresFreshBuildAtConfirm !== false ||
    capability.requiresFreshFeeAtConfirm !== false ||
    sideEffectsCommitted ||
    typeof encodedTx === 'undefined' ||
    encodedTx === null ||
    artifact?.outputKind !== capability.outputKind ||
    artifact?.preparationMode !== capability.preparationMode
  ) {
    return false;
  }

  return canReuseSwapReviewPreparationArtifact({
    artifact,
    identity,
    now,
    freshnessFingerprint,
  });
}
