import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { LOCAL_SECRET_ENVELOPE_VERSION } from './consts';
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

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new OneKeyLocalError(message);
  }
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
  for (let layerIndex = 0; layerIndex < layerAdapters.length; layerIndex += 1) {
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
  const protectedHeader = buildLocalSecretEnvelopeProtectedHeaderV1({
    dataType,
    recordId,
    wrappingLayers,
  });
  const aad = buildLocalSecretEnvelopeAadV1({
    dataType,
    recordId,
    protectedHeader,
  });

  let ciphertext = plaintext;
  for (let layerIndex = 0; layerIndex < layerAdapters.length; layerIndex += 1) {
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
    recordId,
    wrappingLayers,
    strength,
    protectedHeader,
    ciphertext,
  });
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
    } catch {
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
