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
//
// The flush is not guaranteed — the intended panel may never connect (the open
// landed on another window, the user closed it immediately, chrome refused).
// A stale entry must not then be delivered to whatever panel happens to connect
// next, so it carries both a target window and a TTL: mis-delivering an
// login modal the user never asked for is worse than dropping one they can
// simply trigger again.
export const pendingSidePanelBgToUiMessage: {
  value: ISidePanelBgToUiMessage | undefined;
  stashedAt: number;
  targetWindowId: number | undefined;
} = {
  value: undefined,
  stashedAt: 0,
  targetWindowId: undefined,
};

export function clearPendingSidePanelBgToUiMessage() {
  pendingSidePanelBgToUiMessage.value = undefined;
  pendingSidePanelBgToUiMessage.stashedAt = 0;
  pendingSidePanelBgToUiMessage.targetWindowId = undefined;
}

// Sized for a panel that is already opening — the open() call has resolved by
// the time anything is stashed, so a connect is normally under a second away.
// Kept short because the window doubles as the exposure window for delivering
// to a panel the user opened themselves.
export const PENDING_SIDE_PANEL_MESSAGE_TTL_MS = 10 * 1000;
