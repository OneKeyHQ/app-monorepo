import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export const SEGMENT_LOAD_REPRO_TARGET =
  // Bundle Manager does not render this lazy icon before the repro action.
  'seg:components.primitives.Icon.react.brand.ArtifactNews';

type ISegmentLoadReproGlobal = {
  __loadBundleAsync?: (bundlePath: string) => Promise<void>;
};

export async function loadTargetSegmentForRepro(
  globalRef: ISegmentLoadReproGlobal = globalThis as ISegmentLoadReproGlobal,
): Promise<void> {
  const loadBundleAsync = globalRef.__loadBundleAsync;
  if (!loadBundleAsync) {
    throw new OneKeyLocalError(
      'Split bundle loader is unavailable in this runtime.',
    );
  }

  await loadBundleAsync(SEGMENT_LOAD_REPRO_TARGET);
}
