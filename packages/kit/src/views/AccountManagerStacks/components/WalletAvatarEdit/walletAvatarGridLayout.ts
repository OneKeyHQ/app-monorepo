export const AVATAR_COLUMNS = 6;
export const AVATAR_ROW_HEIGHT = 60;
// Title, footer and paddings around the grid, with a little to spare.
const DIALOG_CHROME_HEIGHT = 180;

// The dialog stops at 90% of the window, so in a short window the grid
// scrolls and the footer stays on screen.
export function getAvatarGridHeight({
  avatarCount,
  windowHeight,
}: {
  avatarCount: number;
  windowHeight: number;
}): number {
  const fullHeight =
    Math.ceil(avatarCount / AVATAR_COLUMNS) * AVATAR_ROW_HEIGHT;
  const available = windowHeight * 0.9 - DIALOG_CHROME_HEIGHT;
  return Math.min(fullHeight, Math.max(AVATAR_ROW_HEIGHT * 2, available));
}
