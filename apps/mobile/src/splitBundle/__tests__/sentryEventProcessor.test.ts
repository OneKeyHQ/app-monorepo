import { OneKeyLocalError } from '@onekeyhq/shared/src/errors/errors/localError';

import {
  buildSplitBundleEventProcessor,
  installSplitBundleSentryEventProcessor,
} from '../sentryEventProcessor';

import type { ISentryEvent, ISentryEventHint } from '../sentryEventProcessor';

describe('split-bundle Sentry event processor', () => {
  const getBundleVersion = () => '1.2.3';

  it('tags events whose originalException is "Requiring unknown module 777"', () => {
    const processor = buildSplitBundleEventProcessor(getBundleVersion);
    const input: ISentryEvent = { tags: { existing: 'kept' } };
    const hint: ISentryEventHint = {
      originalException: new Error('Requiring unknown module "777"'),
    };

    const out = processor(input, hint);

    expect(out.tags).toEqual({
      existing: 'kept',
      split_bundle_integrity: 'true',
      split_bundle_unknown_module_id: '777',
    });
    expect(out.extra).toEqual({ bundle_version: '1.2.3' });
  });

  it('tags events for unquoted module ids', () => {
    const processor = buildSplitBundleEventProcessor(getBundleVersion);
    const out = processor(
      {},
      { originalException: new Error('Requiring unknown module 3904') },
    );
    expect(out.tags?.split_bundle_unknown_module_id).toBe('3904');
    expect(out.tags?.split_bundle_integrity).toBe('true');
  });

  it('falls back to "unknown" when bundleVersion getter returns undefined', () => {
    const processor = buildSplitBundleEventProcessor(() => undefined);
    const out = processor(
      {},
      { originalException: new Error('Requiring unknown module 1') },
    );
    expect(out.extra).toEqual({ bundle_version: 'unknown' });
  });

  it('falls back to "unknown" when bundleVersion getter throws', () => {
    const processor = buildSplitBundleEventProcessor(() => {
      throw new OneKeyLocalError('platformEnv died');
    });
    const out = processor(
      {},
      { originalException: new Error('Requiring unknown module 1') },
    );
    expect(out.extra).toEqual({ bundle_version: 'unknown' });
  });

  it('preserves existing extra fields when tagging', () => {
    const processor = buildSplitBundleEventProcessor(getBundleVersion);
    const out = processor(
      { extra: { some_other_key: 42 } },
      { originalException: new Error('Requiring unknown module 9') },
    );
    expect(out.extra).toEqual({
      some_other_key: 42,
      bundle_version: '1.2.3',
    });
  });

  it('does NOT tag unrelated exceptions', () => {
    const processor = buildSplitBundleEventProcessor(getBundleVersion);
    const input: ISentryEvent = { tags: { existing: 'kept' } };
    const out = processor(input, {
      originalException: new Error('something else exploded'),
    });
    expect(out.tags).toEqual({ existing: 'kept' });
    expect(out.extra).toBeUndefined();
  });

  it('does NOT tag when hint is undefined', () => {
    const processor = buildSplitBundleEventProcessor(getBundleVersion);
    const out = processor({ tags: { existing: 'kept' } });
    expect(out.tags).toEqual({ existing: 'kept' });
    expect(out.extra).toBeUndefined();
  });

  it('does NOT tag when hint.originalException is undefined', () => {
    const processor = buildSplitBundleEventProcessor(getBundleVersion);
    const out = processor({ tags: { existing: 'kept' } }, {});
    expect(out.tags).toEqual({ existing: 'kept' });
    expect(out.extra).toBeUndefined();
  });

  it('does NOT tag when originalException is a non-Error matching string', () => {
    const processor = buildSplitBundleEventProcessor(getBundleVersion);
    const out = processor(
      {},
      { originalException: 'Requiring unknown module 1' },
    );
    expect(out.tags).toBeUndefined();
    expect(out.extra).toBeUndefined();
  });

  it('always returns the event reference (mutation, not replacement)', () => {
    const processor = buildSplitBundleEventProcessor(getBundleVersion);
    const input: ISentryEvent = {};
    const out = processor(input, {
      originalException: new Error('Requiring unknown module 1'),
    });
    expect(out).toBe(input);
  });

  it('never throws even when the event object is frozen', () => {
    const processor = buildSplitBundleEventProcessor(getBundleVersion);
    const input: ISentryEvent = Object.freeze({});
    expect(() =>
      processor(input, {
        originalException: new Error('Requiring unknown module 1'),
      }),
    ).not.toThrow();
  });

  it('installSplitBundleSentryEventProcessor registers exactly one processor', () => {
    const addEventProcessor = jest.fn();
    installSplitBundleSentryEventProcessor({
      sentry: { addEventProcessor },
      getBundleVersion,
    });
    expect(addEventProcessor).toHaveBeenCalledTimes(1);
    const registered = addEventProcessor.mock.calls[0][0] as (
      event: ISentryEvent,
      hint?: ISentryEventHint,
    ) => ISentryEvent;
    const out = registered(
      {},
      { originalException: new Error('Requiring unknown module 42') },
    );
    expect(out.tags).toEqual({
      split_bundle_integrity: 'true',
      split_bundle_unknown_module_id: '42',
    });
  });
});
