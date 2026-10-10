import {
  SEGMENT_LOAD_REPRO_TARGET,
  loadTargetSegmentForRepro,
} from './segmentLoadRepro';

describe('segmentLoadRepro', () => {
  it('loads the target segment through the production split bundle loader', async () => {
    const loadBundleAsync = jest.fn(async () => undefined);

    await loadTargetSegmentForRepro({
      __loadBundleAsync: loadBundleAsync,
    });

    expect(loadBundleAsync).toHaveBeenCalledTimes(1);
    expect(loadBundleAsync).toHaveBeenCalledWith(SEGMENT_LOAD_REPRO_TARGET);
  });

  it('rejects when the split bundle loader is unavailable', async () => {
    await expect(loadTargetSegmentForRepro({})).rejects.toThrow(
      'Split bundle loader is unavailable in this runtime.',
    );
  });
});
