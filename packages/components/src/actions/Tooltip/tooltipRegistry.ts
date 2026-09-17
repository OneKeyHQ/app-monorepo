// Registry of tooltips that are currently open. Modal navigation calls
// closeAllTooltips() because pushing a modal does not move the pointer, so no
// mouseleave fires and a hover tooltip would otherwise linger above the modal.
const openTooltipClosers = new Set<() => void>();

export function registerOpenTooltip(close: () => void): () => void {
  openTooltipClosers.add(close);
  return () => {
    openTooltipClosers.delete(close);
  };
}

export function closeAllTooltips() {
  // Snapshot first: a closer may unregister itself synchronously.
  Array.from(openTooltipClosers).forEach((close) => close());
}
