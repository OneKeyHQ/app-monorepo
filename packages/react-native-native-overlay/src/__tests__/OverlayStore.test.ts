import { OverlayStore } from '../OverlayStore';

import type { IOverlayDismissReason, IOverlayRequest } from '../types';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

function ids(store: OverlayStore): string[] {
  return store.getSnapshot().entries.map((e) => e.id);
}

function activeIds(store: OverlayStore): string[] {
  return store
    .getSnapshot()
    .entries.filter((e) => e.phase === 'active' && !e.suspended)
    .map((e) => e.id);
}

function page(
  id: string,
  ownerKey: string,
  extra: Partial<IOverlayRequest> = {},
): IOverlayRequest {
  return { id, scope: 'page', hostKey: 'main', ownerKey, ...extra };
}

describe('OverlayStore ordering', () => {
  it('orders global entries by level regardless of request order', () => {
    const store = new OverlayStore();
    store.request({ id: 'toast', level: 'toast' });
    store.request({ id: 'lock', level: 'lock' });
    store.request({ id: 'sheet', level: 'modal' });
    store.request({ id: 'pin', level: 'hardware' });
    store.request({ id: 'password', level: 'secure' });
    expect(ids(store)).toEqual(['sheet', 'pin', 'password', 'toast', 'lock']);
  });

  it('stacks newest on top within a level', () => {
    const store = new OverlayStore();
    store.request({ id: 'a' });
    store.request({ id: 'b' });
    store.request({ id: 'c' });
    expect(ids(store)).toEqual(['a', 'b', 'c']);
  });

  it('renders every page entry below every global entry', () => {
    const store = new OverlayStore();
    store.request({ id: 'global-modal', level: 'modal' });
    store.request(page('page-secure', 'swap', { level: 'secure' }));
    expect(ids(store)).toEqual(['page-secure', 'global-modal']);
  });

  it('ignores a repeated request id', () => {
    const store = new OverlayStore();
    store.request({ id: 'a' });
    store.request({ id: 'a', level: 'toast' });
    expect(store.getSnapshot().entries).toHaveLength(1);
    expect(store.getEntry('a')?.level).toBe('modal');
  });

  it('requires host and owner keys for page scope', () => {
    const store = new OverlayStore();
    expect(() => store.request({ scope: 'page', hostKey: 'main' })).toThrow();
  });
});

describe('OverlayStore strategies', () => {
  it('queue waits for the lane to empty, ordered by priority', () => {
    const store = new OverlayStore();
    store.request({ id: 'first', level: 'hardware', strategy: 'queue' });
    store.request({ id: 'low', level: 'hardware', strategy: 'queue' });
    store.request({
      id: 'urgent',
      level: 'hardware',
      strategy: 'queue',
      priority: 10,
    });
    expect(activeIds(store)).toEqual(['first']);
    expect(store.getSnapshot().queued.map((e) => e.id)).toEqual([
      'urgent',
      'low',
    ]);

    store.dismiss('first');
    // The next queued entry waits for the exit animation to finish.
    expect(activeIds(store)).toEqual([]);
    store.finalize('first');
    expect(activeIds(store)).toEqual(['urgent']);
    store.dismiss('urgent');
    store.finalize('urgent');
    expect(activeIds(store)).toEqual(['low']);
  });

  it('queue only waits on its own lane', () => {
    const store = new OverlayStore();
    store.request({ id: 'modal', level: 'modal' });
    store.request({ id: 'pin', level: 'hardware', strategy: 'queue' });
    expect(activeIds(store)).toEqual(['modal', 'pin']);
  });

  it('stack ignores queued entries', () => {
    const store = new OverlayStore();
    store.request({ id: 'a', strategy: 'queue' });
    store.request({ id: 'b', strategy: 'queue' });
    store.request({ id: 'c' });
    expect(activeIds(store)).toEqual(['a', 'c']);
  });

  it('replace closes the top active entry of the lane', () => {
    const store = new OverlayStore();
    const removed: IOverlayDismissReason[] = [];
    store.request({ id: 'a' });
    store.request(
      { id: 'loading-1' },
      { onRemoved: (reason) => removed.push(reason) },
    );
    store.request({ id: 'loading-2', strategy: 'replace' });
    expect(store.getEntry('loading-1')?.phase).toBe('closing');
    expect(store.getEntry('loading-1')?.dismissReason).toBe('replaced');
    expect(activeIds(store)).toEqual(['a', 'loading-2']);
    store.finalize('loading-1');
    expect(removed).toEqual(['replaced']);
  });

  it('replace with a key only closes entries sharing that key', () => {
    const store = new OverlayStore();
    store.request({ id: 'other' });
    store.request({ id: 'status-1', replaceKey: 'hw-status' });
    store.request({
      id: 'status-2',
      strategy: 'replace',
      replaceKey: 'hw-status',
    });
    expect(activeIds(store)).toEqual(['other', 'status-2']);
  });
});

describe('OverlayStore closing lifecycle', () => {
  it('finalizes a closing entry after the fallback timeout', () => {
    const store = new OverlayStore({ closingTimeoutMs: 100 });
    const onRemoved = jest.fn();
    store.request({ id: 'a' }, { onRemoved });
    store.dismiss('a', 'backdrop');
    jest.advanceTimersByTime(99);
    expect(store.getEntry('a')).toBeDefined();
    jest.advanceTimersByTime(1);
    expect(store.getEntry('a')).toBeUndefined();
    expect(onRemoved).toHaveBeenCalledWith('backdrop');
  });

  it('calls onRemoved once even when finalize races the timeout', () => {
    const store = new OverlayStore({ closingTimeoutMs: 100 });
    const onRemoved = jest.fn();
    store.request({ id: 'a' }, { onRemoved });
    store.dismiss('a');
    store.dismiss('a');
    store.finalize('a');
    jest.advanceTimersByTime(200);
    expect(onRemoved).toHaveBeenCalledTimes(1);
  });

  it('dismissAll below a level keeps higher levels', () => {
    const store = new OverlayStore();
    store.request({ id: 'modal' });
    store.request({ id: 'pin', level: 'hardware' });
    store.request({ id: 'lock', level: 'lock' });
    store.dismissAll({ belowLevel: 'secure' });
    expect(activeIds(store)).toEqual(['lock']);
  });
});

describe('OverlayStore page scope', () => {
  it('suspends entries while the owning page is hidden and restores them', () => {
    const store = new OverlayStore();
    store.request(page('dialog', 'swap'));
    store.setPageVisible('swap', false);
    expect(activeIds(store)).toEqual([]);
    expect(store.getEntry('dialog')?.phase).toBe('active');
    store.setPageVisible('swap', true);
    expect(activeIds(store)).toEqual(['dialog']);
  });

  it('does not promote queued entries into a hidden page', () => {
    const store = new OverlayStore();
    store.setPageVisible('swap', false);
    store.request(page('queued', 'swap', { strategy: 'queue' }));
    expect(store.getSnapshot().queued.map((e) => e.id)).toEqual(['queued']);
    store.setPageVisible('swap', true);
    expect(activeIds(store)).toEqual(['queued']);
  });

  it('closes entries with page-removed when the page leaves', () => {
    const store = new OverlayStore();
    const shownRemoved = jest.fn();
    const queuedRemoved = jest.fn();
    store.request(page('shown', 'swap'), { onRemoved: shownRemoved });
    store.request(page('waiting', 'swap', { strategy: 'queue' }), {
      onRemoved: queuedRemoved,
    });
    store.removePage('swap');
    expect(store.getEntry('shown')?.dismissReason).toBe('page-removed');
    expect(queuedRemoved).toHaveBeenCalledWith('page-removed');
    store.finalize('shown');
    expect(shownRemoved).toHaveBeenCalledWith('page-removed');
  });
});

describe('OverlayStore back resolution', () => {
  it('routes back to the topmost blocking global entry first', () => {
    const store = new OverlayStore();
    store.request(page('page-dialog', 'swap'));
    store.request({ id: 'sheet' });
    store.request({ id: 'toast', level: 'toast' });
    expect(store.resolveBack()).toEqual({ kind: 'dismiss', id: 'sheet' });
    store.dismiss('sheet');
    expect(store.resolveBack()).toEqual({ kind: 'dismiss', id: 'page-dialog' });
  });

  it('blocks back under a non-dismissible entry', () => {
    const store = new OverlayStore();
    store.request({ id: 'sheet' });
    store.request({ id: 'lock', level: 'lock', dismissible: false });
    expect(store.resolveBack()).toEqual({ kind: 'block' });
  });

  it('passes back when only non-blocking entries remain', () => {
    const store = new OverlayStore();
    store.request({ id: 'toast', level: 'toast' });
    expect(store.resolveBack()).toEqual({ kind: 'pass' });
  });

  it('limits page entries to the focused host', () => {
    const store = new OverlayStore();
    store.request({
      id: 'detail-dialog',
      scope: 'page',
      hostKey: 'detail',
      ownerKey: 'd1',
    });
    expect(store.resolveBack('main')).toEqual({ kind: 'pass' });
    expect(store.resolveBack('detail')).toEqual({
      kind: 'dismiss',
      id: 'detail-dialog',
    });
  });

  it('reports the topmost blocking entry for inert handling', () => {
    const store = new OverlayStore();
    store.request({ id: 'sheet' });
    store.request({ id: 'toast', level: 'toast' });
    expect(store.getBlockingTop()?.id).toBe('sheet');
  });
});

describe('OverlayStore status bar owner', () => {
  it('follows the topmost shown entry that sets a style', () => {
    const store = new OverlayStore();
    store.request({ id: 'lock', level: 'lock', statusBarStyle: 'light' });
    store.request({ id: 'dialog', statusBarStyle: 'dark' });
    store.request({ id: 'toast', level: 'toast', blocking: false });
    expect(store.getStatusBarOwner()?.id).toBe('lock');

    store.dismiss('lock');
    expect(store.getStatusBarOwner()?.id).toBe('dialog');
    store.finalize('lock');
    store.dismiss('dialog');
    expect(store.getStatusBarOwner()).toBeUndefined();
  });

  it('skips suspended page entries', () => {
    const store = new OverlayStore();
    store.request({
      id: 'page',
      scope: 'page',
      hostKey: 'host',
      ownerKey: 'owner',
      statusBarStyle: 'light',
    });
    expect(store.getStatusBarOwner()?.id).toBe('page');
    store.setPageVisible('owner', false);
    expect(store.getStatusBarOwner()).toBeUndefined();
  });
});
