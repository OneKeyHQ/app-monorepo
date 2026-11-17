const DESKTOP_DIALOG_CHROME_HEIGHT = 154;

export function getUnifoldDesktopDialogBodyMaxHeight(
  windowHeight: number,
): number {
  return Math.max(0, windowHeight - DESKTOP_DIALOG_CHROME_HEIGHT);
}
