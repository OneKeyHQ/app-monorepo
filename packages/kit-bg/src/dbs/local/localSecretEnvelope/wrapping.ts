import {
  LocalSecretEnvelopeUnavailable,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import {
  LOCAL_SECRET_ENVELOPE_VERSION,
  getLocalSecretEnvelopeInnerPrefix,
} from './consts';
import {
  buildLocalSecretEnvelopeAadV1,
  buildLocalSecretEnvelopeProtectedHeaderV1,
  parseLocalSecretEnvelopeV1,
  serializeLocalSecretEnvelopeV1,
} from './parser';

import type {
  ILocalSecretEnvelopeDataType,
  ILocalSecretEnvelopeLayer,
  ILocalSecretEnvelopeLayerAdapter,
  ILocalSecretEnvelopeLayerAdapterResolver,
  ILocalSecretEnvelopeStrength,
} from './types';

const AES_GCM_NONCE_BYTES = 12;

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new OneKeyLocalError(message);
  }
}

function defaultRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const cryptoGlobal = globalThis.crypto;
  const getRandomValues = cryptoGlobal?.getRandomValues?.bind(cryptoGlobal);
  invariant(
    typeof getRandomValues === 'function',
    'Local secret envelope secure random is unavailable',
  );
  getRandomValues(bytes);
  return bytes;
}

function buildLayerErrorMessage({
  layer,
  layerIndex,
  message,
}: {
  layer: ILocalSecretEnvelopeLayer;
  layerIndex: number;
  message: string;
}) {
  return `${message}: kind=${layer.kind}, index=${layerIndex}`;
}

async function prepareWrappingLayers({
  dataType,
  layerAdapters,
  recordId,
}: {
  dataType: ILocalSecretEnvelopeDataType;
  layerAdapters: ILocalSecretEnvelopeLayerAdapter[];
  recordId: string;
}): Promise<ILocalSecretEnvelopeLayer[]> {
  const layers: ILocalSecretEnvelopeLayer[] = [];
  try {
    for (
      let layerIndex = 0;
      layerIndex < layerAdapters.length;
      layerIndex += 1
    ) {
      const adapter = layerAdapters[layerIndex];
      const layer = await adapter.prepareLayer({
        dataType,
        layerIndex,
        recordId,
      });
      invariant(
        layer.kind === adapter.kind,
        'Local secret envelope layer adapter kind mismatch',
      );
      layers.push(layer);
    }
    return layers;
  } catch (error) {
    await cleanupWrappingLayerKeysBestEffort({
      dataType,
      layerAdapters,
      layers,
      recordId,
    });
    throw error;
  }
}

async function cleanupWrappingLayerKeysBestEffort({
  dataType,
  layerAdapters,
  layers,
  recordId,
}: {
  dataType: ILocalSecretEnvelopeDataType;
  layerAdapters: ILocalSecretEnvelopeLayerAdapter[];
  layers: ILocalSecretEnvelopeLayer[];
  recordId: string;
}): Promise<void> {
  await Promise.all(
    layers.map(async (layer, layerIndex) => {
      const adapter = layerAdapters[layerIndex];
      if (!adapter?.deleteLayerKey) {
        return;
      }
      try {
        await adapter.deleteLayerKey({ dataType, layer, layerIndex, recordId });
      } catch {
        // best-effort cleanup; ignore
      }
    }),
  );
}

type ILocalSecretEnvelopeTopologyUpgradeLayer = {
  adapter: ILocalSecretEnvelopeLayerAdapter;
  isNew: boolean;
  layer: ILocalSecretEnvelopeLayer;
  layerIndex: number;
};

async function cleanupNewTopologyUpgradeLayerKeysBestEffort({
  dataType,
  layers,
  recordId,
}: {
  dataType: ILocalSecretEnvelopeDataType;
  layers: ILocalSecretEnvelopeTopologyUpgradeLayer[];
  recordId: string;
}): Promise<void> {
  await Promise.all(
    layers.map(async ({ adapter, isNew, layer, layerIndex }) => {
      if (!isNew || !adapter.deleteLayerKey) {
        return;
      }
      try {
        await adapter.deleteLayerKey({
          dataType,
          layer,
          layerIndex,
          recordId,
        });
      } catch {
        // Best-effort cleanup must never mask the topology-upgrade error.
      }
    }),
  );
}

export async function wrapLocalSecretEnvelopeV1({
  dataType,
  layerAdapters,
  plaintext,
  recordId,
  strength,
}: {
  dataType: ILocalSecretEnvelopeDataType;
  layerAdapters: ILocalSecretEnvelopeLayerAdapter[];
  plaintext: string;
  recordId: string;
  strength: ILocalSecretEnvelopeStrength;
}): Promise<string> {
  invariant(recordId.length > 0, 'Local secret envelope recordId is required');
  invariant(
    layerAdapters.length > 0,
    'Local secret envelope requires at least one wrapping layer',
  );
  invariant(
    strength !== 'unavailable',
    'Local secret envelope requires an available strength',
  );

  const wrappingLayers = await prepareWrappingLayers({
    dataType,
    layerAdapters,
    recordId,
  });
  try {
    const innerPrefix = getLocalSecretEnvelopeInnerPrefix(plaintext);
    const protectedHeader = buildLocalSecretEnvelopeProtectedHeaderV1({
      dataType,
      innerPrefix,
      recordId,
      wrappingLayers,
    });
    const aad = buildLocalSecretEnvelopeAadV1({
      dataType,
      recordId,
      protectedHeader,
    });

    let ciphertext = plaintext;
    for (
      let layerIndex = 0;
      layerIndex < layerAdapters.length;
      layerIndex += 1
    ) {
      ciphertext = await layerAdapters[layerIndex].encrypt({
        aad,
        dataType,
        layer: wrappingLayers[layerIndex],
        layerIndex,
        plaintext: ciphertext,
        recordId,
      });
    }

    return serializeLocalSecretEnvelopeV1({
      version: LOCAL_SECRET_ENVELOPE_VERSION,
      dataType,
      ...(innerPrefix ? { innerPrefix } : undefined),
      recordId,
      wrappingLayers,
      strength,
      protectedHeader,
      ciphertext,
    });
  } catch (error) {
    await cleanupWrappingLayerKeysBestEffort({
      dataType,
      layerAdapters,
      layers: wrappingLayers,
      recordId,
    });
    throw error;
  }
}

export async function upgradeLocalSecretEnvelopeLayerTopologyV1({
  envelope,
  expectedDataType,
  expectedRecordId,
  layerAdapters,
  plaintext,
  randomBytes = defaultRandomBytes,
  strength,
}: {
  envelope: string;
  expectedDataType?: ILocalSecretEnvelopeDataType;
  expectedRecordId?: string;
  layerAdapters: ILocalSecretEnvelopeLayerAdapter[];
  plaintext: string;
  randomBytes?: (length: number) => Uint8Array;
  strength: ILocalSecretEnvelopeStrength;
}): Promise<string> {
  const parsed = parseLocalSecretEnvelopeV1(envelope);
  invariant(
    !expectedDataType || parsed.dataType === expectedDataType,
    'Local secret envelope dataType mismatch',
  );
  invariant(
    !expectedRecordId || parsed.recordId === expectedRecordId,
    'Local secret envelope recordId mismatch',
  );
  invariant(
    layerAdapters.length > parsed.wrappingLayers.length,
    'Local secret envelope topology upgrade requires additional layers',
  );
  invariant(
    strength !== 'unavailable',
    'Local secret envelope topology upgrade requires an available strength',
  );

  const originalLayersByKind = new Map(
    parsed.wrappingLayers.map((layer) => [layer.kind, layer]),
  );
  invariant(
    originalLayersByKind.size === parsed.wrappingLayers.length,
    'Local secret envelope topology upgrade requires unique persisted layer kinds',
  );
  const targetLayerKinds = new Set(
    layerAdapters.map((adapter) => adapter.kind),
  );
  invariant(
    targetLayerKinds.size === layerAdapters.length,
    'Local secret envelope topology upgrade requires unique target layer kinds',
  );
  invariant(
    parsed.wrappingLayers.every((layer) => targetLayerKinds.has(layer.kind)),
    'Local secret envelope topology upgrade cannot remove persisted layers',
  );

  const topologyLayers: ILocalSecretEnvelopeTopologyUpgradeLayer[] = [];
  try {
    for (
      let layerIndex = 0;
      layerIndex < layerAdapters.length;
      layerIndex += 1
    ) {
      const adapter = layerAdapters[layerIndex];
      const originalLayer = originalLayersByKind.get(adapter.kind);
      if (originalLayer) {
        invariant(
          originalLayer.alg === 'AES-256-GCM',
          buildLayerErrorMessage({
            layer: originalLayer,
            layerIndex,
            message:
              'Local secret envelope layer cannot be reused for topology upgrade',
          }),
        );
        topologyLayers.push({
          adapter,
          isNew: false,
          layer: {
            ...originalLayer,
            iv: bufferUtils.bytesToHex(randomBytes(AES_GCM_NONCE_BYTES)),
          },
          layerIndex,
        });
      } else {
        const layer = await adapter.prepareLayer({
          dataType: parsed.dataType,
          layerIndex,
          recordId: parsed.recordId,
        });
        invariant(
          layer.kind === adapter.kind,
          'Local secret envelope layer adapter kind mismatch',
        );
        topologyLayers.push({ adapter, isNew: true, layer, layerIndex });
      }
    }

    const wrappingLayers = topologyLayers.map(({ layer }) => layer);
    const innerPrefix =
      getLocalSecretEnvelopeInnerPrefix(plaintext) ?? parsed.innerPrefix;
    const protectedHeader = buildLocalSecretEnvelopeProtectedHeaderV1({
      dataType: parsed.dataType,
      innerPrefix,
      recordId: parsed.recordId,
      wrappingLayers,
    });
    const aad = buildLocalSecretEnvelopeAadV1({
      dataType: parsed.dataType,
      recordId: parsed.recordId,
      protectedHeader,
    });

    let ciphertext = plaintext;
    for (const { adapter, isNew, layer, layerIndex } of topologyLayers) {
      if (isNew) {
        ciphertext = await adapter.encrypt({
          aad,
          dataType: parsed.dataType,
          layer,
          layerIndex,
          plaintext: ciphertext,
          recordId: parsed.recordId,
        });
      } else {
        const encryptWithExistingKey = adapter.encryptWithExistingKey;
        invariant(
          typeof encryptWithExistingKey === 'function',
          buildLayerErrorMessage({
            layer,
            layerIndex,
            message:
              'Local secret envelope layer existing-key encrypt is unavailable',
          }),
        );
        ciphertext = await encryptWithExistingKey({
          aad,
          dataType: parsed.dataType,
          layer,
          layerIndex,
          plaintext: ciphertext,
          recordId: parsed.recordId,
        });
      }
    }

    return serializeLocalSecretEnvelopeV1({
      version: LOCAL_SECRET_ENVELOPE_VERSION,
      dataType: parsed.dataType,
      ...(innerPrefix ? { innerPrefix } : undefined),
      recordId: parsed.recordId,
      wrappingLayers,
      strength,
      protectedHeader,
      ciphertext,
    });
  } catch (error) {
    await cleanupNewTopologyUpgradeLayerKeysBestEffort({
      dataType: parsed.dataType,
      layers: topologyLayers,
      recordId: parsed.recordId,
    });
    throw error;
  }
}

export async function unwrapLocalSecretEnvelopeV1({
  envelope,
  expectedDataType,
  expectedRecordId,
  resolveLayerAdapter,
}: {
  envelope: string;
  expectedDataType?: ILocalSecretEnvelopeDataType;
  expectedRecordId?: string;
  resolveLayerAdapter: ILocalSecretEnvelopeLayerAdapterResolver;
}): Promise<string> {
  const parsed = parseLocalSecretEnvelopeV1(envelope);
  invariant(
    !expectedDataType || parsed.dataType === expectedDataType,
    'Local secret envelope dataType mismatch',
  );
  invariant(
    !expectedRecordId || parsed.recordId === expectedRecordId,
    'Local secret envelope recordId mismatch',
  );
  const aad = buildLocalSecretEnvelopeAadV1({
    dataType: parsed.dataType,
    recordId: parsed.recordId,
    protectedHeader: parsed.protectedHeader,
  });

  let plaintext = parsed.ciphertext;
  for (
    let layerIndex = parsed.wrappingLayers.length - 1;
    layerIndex >= 0;
    layerIndex -= 1
  ) {
    const layer = parsed.wrappingLayers[layerIndex];
    const adapter = resolveLayerAdapter(layer);
    invariant(
      adapter?.kind === layer.kind,
      buildLayerErrorMessage({
        layer,
        layerIndex,
        message: 'Local secret envelope layer adapter is unavailable',
      }),
    );
    try {
      plaintext = await adapter.decrypt({
        aad,
        ciphertext: plaintext,
        dataType: parsed.dataType,
        layer,
        layerIndex,
        recordId: parsed.recordId,
      });
    } catch (error) {
      if (error instanceof LocalSecretEnvelopeUnavailable) {
        throw error;
      }
      throw new OneKeyLocalError(
        buildLayerErrorMessage({
          layer,
          layerIndex,
          message: 'Local secret envelope layer decrypt failed',
        }),
      );
    }
  }
  return plaintext;
}

export async function rewrapLocalSecretEnvelopeV1({
  envelope,
  expectedDataType,
  expectedRecordId,
  plaintext,
  randomBytes = defaultRandomBytes,
  resolveLayerAdapter,
}: {
  envelope: string;
  expectedDataType?: ILocalSecretEnvelopeDataType;
  expectedRecordId?: string;
  plaintext: string;
  randomBytes?: (length: number) => Uint8Array;
  resolveLayerAdapter: ILocalSecretEnvelopeLayerAdapterResolver;
}): Promise<string> {
  const parsed = parseLocalSecretEnvelopeV1(envelope);
  invariant(
    !expectedDataType || parsed.dataType === expectedDataType,
    'Local secret envelope dataType mismatch',
  );
  invariant(
    !expectedRecordId || parsed.recordId === expectedRecordId,
    'Local secret envelope recordId mismatch',
  );

  const wrappingLayers = parsed.wrappingLayers.map((layer, layerIndex) => {
    invariant(
      layer.alg === 'AES-256-GCM',
      buildLayerErrorMessage({
        layer,
        layerIndex,
        message: 'Local secret envelope layer cannot be rewrapped',
      }),
    );
    return {
      ...layer,
      iv: bufferUtils.bytesToHex(randomBytes(AES_GCM_NONCE_BYTES)),
    };
  });
  // Re-encryption may also migrate the inner credential format (for example,
  // HLP to HLE). Bind the protected header to the new prefix when known.
  const innerPrefix =
    getLocalSecretEnvelopeInnerPrefix(plaintext) ?? parsed.innerPrefix;
  const protectedHeader = buildLocalSecretEnvelopeProtectedHeaderV1({
    dataType: parsed.dataType,
    innerPrefix,
    recordId: parsed.recordId,
    wrappingLayers,
  });
  const aad = buildLocalSecretEnvelopeAadV1({
    dataType: parsed.dataType,
    recordId: parsed.recordId,
    protectedHeader,
  });

  let ciphertext = plaintext;
  for (
    let layerIndex = 0;
    layerIndex < wrappingLayers.length;
    layerIndex += 1
  ) {
    const layer = wrappingLayers[layerIndex];
    const adapter = resolveLayerAdapter(layer);
    invariant(
      adapter?.kind === layer.kind,
      buildLayerErrorMessage({
        layer,
        layerIndex,
        message: 'Local secret envelope layer adapter is unavailable',
      }),
    );
    const encryptWithExistingKey = adapter.encryptWithExistingKey;
    invariant(
      typeof encryptWithExistingKey === 'function',
      buildLayerErrorMessage({
        layer,
        layerIndex,
        message:
          'Local secret envelope layer existing-key encrypt is unavailable',
      }),
    );
    try {
      ciphertext = await encryptWithExistingKey({
        aad,
        dataType: parsed.dataType,
        layer,
        layerIndex,
        plaintext: ciphertext,
        recordId: parsed.recordId,
      });
    } catch {
      throw new OneKeyLocalError(
        buildLayerErrorMessage({
          layer,
          layerIndex,
          message: 'Local secret envelope layer rewrap failed',
        }),
      );
    }
  }

  return serializeLocalSecretEnvelopeV1({
    version: LOCAL_SECRET_ENVELOPE_VERSION,
    dataType: parsed.dataType,
    ...(innerPrefix ? { innerPrefix } : undefined),
    recordId: parsed.recordId,
    wrappingLayers,
    strength: parsed.strength,
    protectedHeader,
    ciphertext,
  });
}

export function isLocalSecretEnvelopeLayerTopologyDowngrade({
  currentEnvelope,
  nextEnvelope,
}: {
  currentEnvelope: string;
  nextEnvelope: string;
}): boolean {
  const current = parseLocalSecretEnvelopeV1(currentEnvelope);
  const next = parseLocalSecretEnvelopeV1(nextEnvelope);
  const nextLayerKinds = new Set(
    next.wrappingLayers.map((layer) => layer.kind),
  );
  return (
    next.wrappingLayers.length < current.wrappingLayers.length ||
    current.wrappingLayers.some((layer) => !nextLayerKinds.has(layer.kind))
  );
}
