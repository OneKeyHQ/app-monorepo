export function resolveProtocolPositionActionDialogLayout({
  gtMd,
}: {
  gtMd: boolean;
}) {
  return {
    bodyMaxHeight: gtMd ? 420 : 360,
    feedbackMaxHeight: gtMd ? 160 : 128,
  };
}
