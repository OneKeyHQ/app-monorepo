export function shouldRenderMobileOpenOrdersNativeTree({
  isNative,
  isMobile,
  isPanelActive,
}: {
  isNative: boolean;
  isMobile?: boolean;
  isPanelActive?: boolean;
}) {
  return !(isNative && isMobile && isPanelActive === false);
}
