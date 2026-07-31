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
// TTL'd because the flush is not guaranteed: if the open fails and no port ever
// connects, a stale entry must not be replayed into an unrelated later boot.
export const pendingSidePanelBgToUiMessage: {
  value: ISidePanelBgToUiMessage | undefined;
  stashedAt: number;
} = {
  value: undefined,
  stashedAt: 0,
};

export const PENDING_SIDE_PANEL_MESSAGE_TTL_MS = 30 * 1000;
