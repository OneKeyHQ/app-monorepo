export const sidePanelState: {
  isOpen: boolean;
} = {
  isOpen: false,
};

// OK-58962. Deliberately separate from `sidePanelState`: the two are written in
// different runtimes. `isOpen` is owned by bg; this is owned by the side
// panel's own UI runtime and is set when bg asks that page to host a pushed
// modal — a DApp approval, or the Keyless / OneKey-ID onboarding hand-off,
// which never goes through ServiceDApp.openModal.
//
// Boot-time interruptive UI reads it to stand down. It has to be a UI-local
// flag rather than a bg query: the push routinely lands before React has
// rendered, so there is no navigation state to inspect yet, and bg has already
// cleared its own pending-keyless marker by that point.
export const sidePanelUiState: {
  isHostingPushedModal: boolean;
} = {
  isHostingPushedModal: false,
};
