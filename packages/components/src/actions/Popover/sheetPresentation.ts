export function shouldUseNativeSheetPresentation({
  usingSheet,
  nativeSheet,
  isGtMd,
  isNativeIOSPad,
}: {
  usingSheet: boolean;
  nativeSheet: boolean;
  isGtMd: boolean;
  isNativeIOSPad: boolean;
}) {
  return usingSheet && nativeSheet && !isGtMd && !isNativeIOSPad;
}
