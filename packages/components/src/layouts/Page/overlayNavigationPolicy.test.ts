import { OverlayStore } from '@onekeyfe/react-native-native-overlay';

const page = { scope: 'page' as const, hostKey: 'main', ownerKey: 'perp' };

it('does not retain a late request between root focus handoff and owner state notification', () => {
  const store = new OverlayStore();
  store.setFocusedPageHost('main');
  const existing = store.request({
    ...page,
    keepVisibleBehindNavigationModal: true,
  });
  const closing = store.request({
    ...page,
    keepVisibleBehindNavigationModal: true,
  });
  store.dismiss(closing.id);
  store.setFocusedPageHost('receive');
  const late = store.request({
    ...page,
    keepVisibleBehindNavigationModal: true,
  });
  const queued = store.request({
    ...page,
    strategy: 'queue',
    keepVisibleBehindNavigationModal: true,
  });
  store.reopen(closing.id);
  expect(late.suspended).toBe(true);
  expect(store.getEntry(closing.id)?.suspended).toBe(true);
  expect(queued.phase).toBe('queued');
  store.setPageState('perp', 'covered-by-navigation-modal');
  expect(store.getEntry(existing.id)?.suspended).toBe(false);
  expect(store.getEntry(late.id)?.suspended).toBe(true);
  expect(store.getEntry(closing.id)?.suspended).toBe(true);
});

it('restores a deferred request after rapid focus return without an owner-state transition', () => {
  const store = new OverlayStore();
  store.setFocusedPageHost('receive');
  const deferred = store.request({
    ...page,
    keepVisibleBehindNavigationModal: true,
  });
  expect(deferred.suspended).toBe(true);
  store.setFocusedPageHost('main');
  expect(store.getEntry(deferred.id)?.suspended).toBe(false);
  expect(store.getBlockingTop()?.id).toBe(deferred.id);
  store.setFocusedPageHost('receive');
  const queued = store.request({
    ...page,
    ownerKey: 'another',
    hostKey: 'other-host',
    strategy: 'queue',
  });
  expect(queued.phase).toBe('queued');
  store.setFocusedPageHost('other-host');
  expect(store.getEntry(queued.id)?.phase).toBe('active');
  expect(store.getEntry(queued.id)?.suspended).toBe(false);
});

it('defaults to hiding covered dialogs while preserving only explicitly opted-in entries', () => {
  const store = new OverlayStore();
  const ordinary = store.request(page);
  const retained = store.request({
    ...page,
    keepVisibleBehindNavigationModal: true,
  });
  store.setFocusedPageHost('receive');
  store.setPageState('perp', 'covered-by-navigation-modal');
  expect(store.getEntry(ordinary.id)?.suspended).toBe(true);
  expect(store.getEntry(retained.id)?.suspended).toBe(false);
  expect(store.getBlockingTop()).toBeUndefined();
  expect(store.resolveBack()).toEqual({ kind: 'pass' });
  store.setPageState('perp', 'hidden');
  expect(store.getEntry(retained.id)?.suspended).toBe(true);
  store.setPageState('perp', 'covered-by-navigation-modal');
  expect(store.getEntry(retained.id)?.suspended).toBe(false);
  expect(store.getEntry(ordinary.id)?.suspended).toBe(true);
  store.setPageState('perp', 'active');
  store.setFocusedPageHost('main');
  expect(store.getEntry(ordinary.id)?.suspended).toBe(false);
  expect(store.getBlockingTop()?.id).toBe(retained.id);
});

it('does not reveal opted-in dialogs created after their owner lost the foreground', () => {
  const store = new OverlayStore();
  store.setPageState('perp', 'covered-by-navigation-modal');
  const late = store.request({
    ...page,
    keepVisibleBehindNavigationModal: true,
  });
  expect(late.suspended).toBe(true);
  store.setPageState('perp', 'hidden');
  store.setPageState('perp', 'covered-by-navigation-modal');
  expect(store.getEntry(late.id)?.suspended).toBe(true);
  store.setPageState('perp', 'active');
  expect(store.getEntry(late.id)?.suspended).toBe(false);
  store.setPageState('perp', 'covered-by-navigation-modal');
  expect(store.getEntry(late.id)?.suspended).toBe(false);
});

it('does not promote an opted-in queue behind a navigation modal', () => {
  const store = new OverlayStore();
  const first = store.request({
    ...page,
    keepVisibleBehindNavigationModal: true,
  });
  const queued = store.request({
    ...page,
    keepVisibleBehindNavigationModal: true,
    strategy: 'queue',
  });
  store.setPageState('perp', 'covered-by-navigation-modal');
  store.finalize(first.id);
  expect(store.getEntry(queued.id)?.phase).toBe('queued');
  expect(store.getEntry(queued.id)?.suspended).toBe(true);
  store.setPageState('perp', 'active');
  expect(store.getEntry(queued.id)?.phase).toBe('active');
  expect(store.getEntry(queued.id)?.suspended).toBe(false);
});

it('does not reuse retention permission when a dialog reopens in the background', () => {
  const store = new OverlayStore();
  const entry = store.request({
    ...page,
    keepVisibleBehindNavigationModal: true,
  });
  store.setPageState('perp', 'covered-by-navigation-modal');
  store.dismiss(entry.id);
  store.reopen(entry.id);
  expect(store.getEntry(entry.id)?.suspended).toBe(true);
  store.finalize(entry.id);
  const replacement = store.request({
    ...page,
    id: entry.id,
    keepVisibleBehindNavigationModal: true,
  });
  expect(replacement.suspended).toBe(true);
});

it('keeps legacy hidden-page and owner-removal semantics even for opted-in dialogs', () => {
  const store = new OverlayStore();
  const removed = jest.fn();
  const entry = store.request(
    { ...page, keepVisibleBehindNavigationModal: true },
    { onRemoved: removed },
  );
  store.setPageVisible('perp', false);
  expect(store.getEntry(entry.id)?.suspended).toBe(true);
  store.removePage('perp');
  expect(store.getEntry(entry.id)?.phase).toBe('closing');
  store.finalize(entry.id);
  expect(removed).toHaveBeenCalledWith('page-removed');
  expect(store.getEntry(entry.id)).toBeUndefined();
});

it('keeps independent owners isolated and lets global lock layers override retention', () => {
  const store = new OverlayStore();
  const retained = store.request({
    ...page,
    keepVisibleBehindNavigationModal: true,
  });
  const inactive = store.request({
    ...page,
    ownerKey: 'other-tab',
    keepVisibleBehindNavigationModal: true,
  });
  store.setPageState('perp', 'covered-by-navigation-modal');
  store.setPageState('other-tab', 'hidden');
  store.setFocusedPageHost('receive');
  const lock = store.request({ level: 'lock', dismissible: false });
  expect(store.getEntry(retained.id)?.suspended).toBe(false);
  expect(store.getEntry(inactive.id)?.suspended).toBe(true);
  expect(store.getBlockingTop()?.id).toBe(lock.id);
  expect(store.resolveBack()).toEqual({ kind: 'block' });
  store.finalize(lock.id);
  expect(store.resolveBack()).toEqual({ kind: 'pass' });
});
