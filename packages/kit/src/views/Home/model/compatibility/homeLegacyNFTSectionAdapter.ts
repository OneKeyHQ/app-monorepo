import { adaptHomeSectionRenderState } from './homeSectionRenderStateAdapter';

import type { IHomeSectionCoordinatorResolution } from '../sections/homeSectionCoordinator';
import type { IHomeNFTLegacyPayload } from '../sections/nft/homeNFTSourceAdapter';
import type { IHomeSectionSemanticModel } from '../semantic/homeSemanticTypes';

type IHomeLegacyNFTSectionState =
  | { kind: 'loading'; viewState: 'loading' }
  | { kind: 'empty'; viewState: 'empty' }
  | { kind: 'error'; viewState: 'empty'; refresh: 'failed' }
  | {
      kind: 'ready';
      viewState: 'ready';
      payload: IHomeNFTLegacyPayload;
      freshness: 'live' | 'confirmedCache';
      refresh: 'idle' | 'refreshing' | 'failed';
    };

type IHomeLegacyNFTSemanticState =
  | { kind: 'loading'; viewState: 'loading' }
  | { kind: 'empty'; viewState: 'empty' }
  | { kind: 'error'; viewState: 'empty'; refresh: 'failed' }
  | {
      kind: 'ready';
      viewState: 'ready';
      freshness: 'live' | 'confirmedCache';
      refresh: 'idle' | 'refreshing' | 'failed';
    };

function adaptHomeLegacyNFTSection({
  resolution,
}: {
  resolution?: IHomeSectionCoordinatorResolution<IHomeNFTLegacyPayload>;
}): IHomeLegacyNFTSectionState {
  if (!resolution) {
    return { kind: 'loading', viewState: 'loading' };
  }
  const state = adaptHomeSectionRenderState(resolution);
  if (state.kind === 'ready') {
    return {
      kind: 'ready',
      viewState: 'ready',
      payload: state.data,
      freshness: state.freshness,
      refresh: state.refresh,
    };
  }
  if (state.kind === 'empty') return { kind: 'empty', viewState: 'empty' };
  if (state.kind === 'error') {
    return { kind: 'error', viewState: 'empty', refresh: 'failed' };
  }
  return { kind: 'loading', viewState: 'loading' };
}

function adaptHomeLegacyNFTSemanticState({
  semantic,
}: {
  semantic?: IHomeSectionSemanticModel;
}): IHomeLegacyNFTSemanticState | undefined {
  if (!semantic) {
    return undefined;
  }
  if (semantic.kind === 'ready') {
    return {
      kind: 'ready',
      viewState: 'ready',
      freshness: semantic.freshness,
      refresh: semantic.refresh,
    };
  }
  if (semantic.kind === 'empty') return { kind: 'empty', viewState: 'empty' };
  if (semantic.kind === 'error') {
    return { kind: 'error', viewState: 'empty', refresh: 'failed' };
  }
  if (semantic.kind === 'loading') {
    return { kind: 'loading', viewState: 'loading' };
  }
  return undefined;
}

export { adaptHomeLegacyNFTSection, adaptHomeLegacyNFTSemanticState };
export type { IHomeLegacyNFTSectionState, IHomeLegacyNFTSemanticState };
