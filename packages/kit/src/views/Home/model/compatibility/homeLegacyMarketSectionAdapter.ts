import { adaptHomeSectionRenderState } from './homeSectionRenderStateAdapter';

import type { IHomeSectionCoordinatorResolution } from '../sections/homeSectionCoordinator';
import type {
  IHomeMarketLegacyPayload,
  IHomeMarketTokenRow,
} from '../sections/market/homeMarketSourceAdapter';

type IHomeLegacyMarketSectionState<TToken extends IHomeMarketTokenRow> =
  | { kind: 'loading'; viewState: 'loading' }
  | { kind: 'empty'; viewState: 'empty' }
  | { kind: 'error'; viewState: 'empty'; refresh: 'failed' }
  | {
      kind: 'ready';
      viewState: 'ready';
      payload: IHomeMarketLegacyPayload<TToken>;
      freshness: 'live' | 'confirmedCache';
      refresh: 'idle' | 'refreshing' | 'failed';
    };

function adaptHomeLegacyMarketSection<TToken extends IHomeMarketTokenRow>({
  resolution,
}: {
  resolution?: IHomeSectionCoordinatorResolution<
    IHomeMarketLegacyPayload<TToken>
  >;
}): IHomeLegacyMarketSectionState<TToken> {
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

export { adaptHomeLegacyMarketSection };
export type { IHomeLegacyMarketSectionState };
