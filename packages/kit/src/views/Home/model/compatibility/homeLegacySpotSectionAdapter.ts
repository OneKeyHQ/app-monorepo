import { adaptHomeSectionRenderState } from './homeSectionRenderStateAdapter';

import type { IHomeSectionCoordinatorResolution } from '../sections/homeSectionCoordinator';
import type { IHomeSpotLegacyPayload } from '../sections/spot/homeSpotSourceAdapter';

type IHomeLegacySpotSectionState<TContent> =
  | { kind: 'legacy'; content: TContent }
  | { kind: 'loading' }
  | { kind: 'empty'; content: TContent }
  | { kind: 'error'; content: TContent }
  | {
      kind: 'ready';
      content: TContent;
      payload: IHomeSpotLegacyPayload;
      freshness: 'live' | 'confirmedCache';
      refresh: 'idle' | 'refreshing' | 'failed';
    };

function adaptHomeLegacySpotSection<TContent>({
  content,
  enabled,
  resolution,
}: {
  content: TContent;
  enabled: boolean;
  resolution?: IHomeSectionCoordinatorResolution<IHomeSpotLegacyPayload>;
}): IHomeLegacySpotSectionState<TContent> {
  if (!enabled) {
    return { kind: 'legacy', content };
  }
  if (!resolution) {
    return { kind: 'loading' };
  }
  const state = adaptHomeSectionRenderState(resolution);
  if (state.kind === 'ready') {
    return {
      kind: 'ready',
      content,
      payload: state.data,
      freshness: state.freshness,
      refresh: state.refresh,
    };
  }
  if (state.kind === 'empty') return { kind: 'empty', content };
  if (state.kind === 'error') return { kind: 'error', content };
  return { kind: 'loading' };
}

export { adaptHomeLegacySpotSection };
export type { IHomeLegacySpotSectionState };
