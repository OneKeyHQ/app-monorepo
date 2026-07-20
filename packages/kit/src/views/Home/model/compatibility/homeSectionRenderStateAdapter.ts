import type { IHomeSectionCoordinatorResolution } from '../sections/homeSectionCoordinator';

type IHomeSectionRenderState<T> =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error' }
  | {
      kind: 'ready';
      data: T;
      freshness: 'live' | 'confirmedCache';
      refresh: 'idle' | 'refreshing' | 'failed';
    };

function adaptHomeSectionRenderState<T>(
  resolution: IHomeSectionCoordinatorResolution<T>,
): IHomeSectionRenderState<T> {
  const { semantic, authoritative } = resolution;
  if (semantic.kind === 'empty') return { kind: 'empty' };
  if (semantic.kind === 'error') return { kind: 'error' };
  if (
    semantic.kind !== 'ready' ||
    authoritative.kind === 'none' ||
    semantic.freshness !== authoritative.kind
  ) {
    return { kind: 'loading' };
  }
  return {
    kind: 'ready',
    data: authoritative.data,
    freshness: semantic.freshness,
    refresh: semantic.refresh,
  };
}

export { adaptHomeSectionRenderState };
export type { IHomeSectionRenderState };
