import {
  PENDING_SIDE_PANEL_MESSAGE_TTL_MS,
  clearPendingSidePanelBgToUiMessage,
  pendingSidePanelBgToUiMessage,
  shouldFlushPendingSidePanelMessage,
} from './sidePanelUtils';

// OK-58962. The stash decides which side panel receives a pushed modal, and a
// wrong answer is user-visible in both directions: deliver too late and someone
// gets a login screen they never asked for, drop too eagerly and the login they
// did ask for never appears. The predicate is pure precisely so these branches
// are pinned without a Chrome environment.

const STASHED_AT = 1_000_000;

function flushAt(elapsedMs: number, didPushOnboardingModal = false) {
  return shouldFlushPendingSidePanelMessage({
    now: STASHED_AT + elapsedMs,
    stashedAt: STASHED_AT,
    didPushOnboardingModal,
  });
}

describe('shouldFlushPendingSidePanelMessage', () => {
  describe('TTL boundary', () => {
    test('flushes immediately after stashing', () => {
      expect(flushAt(0)).toBe(true);
    });

    test('flushes at one tick before the TTL', () => {
      expect(flushAt(PENDING_SIDE_PANEL_MESSAGE_TTL_MS - 1)).toBe(true);
    });

    test('does NOT flush exactly at the TTL — the bound is exclusive', () => {
      expect(flushAt(PENDING_SIDE_PANEL_MESSAGE_TTL_MS)).toBe(false);
    });

    test('does not flush past the TTL', () => {
      expect(flushAt(PENDING_SIDE_PANEL_MESSAGE_TTL_MS + 1)).toBe(false);
    });
  });

  describe('onboarding modal suppression', () => {
    test('does not stack on a keyless get-started push from the same connect', () => {
      expect(flushAt(0, true)).toBe(false);
    });

    test('suppression wins even while fresh', () => {
      expect(flushAt(PENDING_SIDE_PANEL_MESSAGE_TTL_MS - 1, true)).toBe(false);
    });
  });

  // Guards the window this predicate actually bounds. Freshness is the only
  // thing separating the panel a push was meant for from a panel the user opens
  // right after, so a change here widens a real mis-delivery window rather than
  // just tuning a constant.
  test('TTL stays tight enough to bound mis-delivery', () => {
    expect(PENDING_SIDE_PANEL_MESSAGE_TTL_MS).toBeLessThanOrEqual(5 * 1000);
  });
});

describe('clearPendingSidePanelBgToUiMessage', () => {
  test('resets every field so a dropped entry cannot be picked up later', () => {
    pendingSidePanelBgToUiMessage.value = {
      type: 'pushModal',
      payload: { modalParams: { screen: 'x', params: {} } },
    } as unknown as typeof pendingSidePanelBgToUiMessage.value;
    pendingSidePanelBgToUiMessage.stashedAt = STASHED_AT;

    clearPendingSidePanelBgToUiMessage();

    expect(pendingSidePanelBgToUiMessage.value).toBeUndefined();
    expect(pendingSidePanelBgToUiMessage.stashedAt).toBe(0);
  });
});
