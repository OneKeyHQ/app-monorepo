import { adaptHomeSectionRenderState } from './homeSectionRenderStateAdapter';

import type { IHomeSectionCoordinatorResolution } from '../sections/homeSectionCoordinator';
import type { IHomePerpsLegacyPayload } from '../sections/perps/homePerpsSourceAdapter';

type IHomeLegacyPerpsSectionState =
  | { kind: 'loading'; viewState: 'loading' }
  | { kind: 'empty'; viewState: 'empty' }
  | { kind: 'error'; viewState: 'empty'; refresh: 'failed' }
  | {
      kind: 'ready';
      viewState: 'ready';
      payload: IHomePerpsLegacyPayload;
      freshness: 'live' | 'confirmedCache';
      refresh: 'idle' | 'refreshing' | 'failed';
    };

function adaptHomeLegacyPerpsSection({
  resolution,
}: {
  resolution?: IHomeSectionCoordinatorResolution<IHomePerpsLegacyPayload>;
}): IHomeLegacyPerpsSectionState {
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

export { adaptHomeLegacyPerpsSection };
export type { IHomeLegacyPerpsSectionState };
