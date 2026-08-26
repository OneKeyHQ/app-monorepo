import type {
  EAppEventBusNames,
  IAppEventBusPayload,
} from '../eventBus/appEventBus';

export const sidePanelState: {
  isOpen: boolean;
} = {
  isOpen: false,
};

// OK-58962. Deliberately separate from `sidePanelState`: the two are written in
// different runtimes. `isOpen` is owned by bg; this is owned by the side
// panel's own UI runtime and is set when bg pushes a modal into that page.
//
// LATCH, not live state: it is set once and never cleared for the page's
// lifetime, and it fires for *any* pushed modal — a DApp approval, the Keyless
// hand-off, or a notification opening an ordinary page. That is correct for a
// boot-time gate that reads it once before the page can have handled anything
// else. It is NOT a "currently hosting an approval" signal: a consumer that
// re-reads it later in the session will see a stale `true` for any push that
// ever happened, so do not reuse it for repeated checks without narrowing it
// first.
export const sidePanelUiState: {
  hasReceivedPushedModal: boolean;
} = {
  hasReceivedPushedModal: false,
};

type ISidePanelBgToUiMessage =
  IAppEventBusPayload[EAppEventBusNames.SidePanel_BgToUI];

// bg runtime only. A bg->UI push produced while no side panel port is connected
// would otherwise be dropped: the forwarding listener is registered per-port
// inside onConnect. Stashing it here lets the port-connect handler flush it, so
// callers do not have to guess a delay long enough for the panel to boot — and
// the UI sees the push before it renders rather than racing it.
export const pendingSidePanelBgToUiMessage: {
  value: ISidePanelBgToUiMessage | undefined;
  stashedAt: number;
} = {
  value: undefined,
  stashedAt: 0,
};

export function clearPendingSidePanelBgToUiMessage() {
  pendingSidePanelBgToUiMessage.value = undefined;
  pendingSidePanelBgToUiMessage.stashedAt = 0;
}

// Freshness is the ONLY thing separating the panel a push was meant for from a
// panel the user happens to open right afterwards.
//
// An earlier revision also compared a stashed target window against
// `port.sender.tab.windowId`. That check never ran: `sender.tab` is only
// populated when a connection originates from a tab or content script, and a
// side panel is an extension page — so the comparison silently fell through to
// its fail-open branch every time. Removed rather than left in place, because a
// guard that never fires reads like protection that exists.
//
// The real fix is an identity handshake (bg mints a nonce into the panel URL,
// the panel echoes it back as its first port message, still ahead of render).
// That is not shipped here: it changes the side panel URL and the port
// protocol, and this path cannot be exercised without a live Keyless flow.
//
// So the window is kept deliberately tight instead. The open() call has already
// resolved by the time anything is stashed, so the intended panel normally
// connects well inside a second.
export const PENDING_SIDE_PANEL_MESSAGE_TTL_MS = 5 * 1000;

/**
 * Whether a stashed bg->UI push should be delivered to the panel that just
 * connected. Pure so the branches can be tested without a Chrome environment —
 * the caller clears the stash either way, so a `false` here means dropped, not
 * deferred.
 */
export function shouldFlushPendingSidePanelMessage({
  now,
  stashedAt,
  didPushOnboardingModal,
}: {
  now: number;
  stashedAt: number;
  /** An onboarding modal already went out on this same connect. */
  didPushOnboardingModal: boolean;
}): boolean {
  // Never stack two onboarding modals onto one boot.
  if (didPushOnboardingModal) {
    return false;
  }
  return now - stashedAt < PENDING_SIDE_PANEL_MESSAGE_TTL_MS;
}
