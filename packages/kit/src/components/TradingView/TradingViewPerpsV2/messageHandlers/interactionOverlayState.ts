type IPerpsInteractionOverlayPayload = {
  action?: unknown;
  isOpen?: unknown;
};

export function getPerpsInteractionOverlayOpenState(
  overlayData: unknown,
): boolean | undefined {
  const data = overlayData as IPerpsInteractionOverlayPayload | undefined;
  if (typeof data?.isOpen === 'boolean') {
    return data.isOpen;
  }
  if (data?.action === 'open') {
    return true;
  }
  if (data?.action === 'close') {
    return false;
  }
  return undefined;
}
