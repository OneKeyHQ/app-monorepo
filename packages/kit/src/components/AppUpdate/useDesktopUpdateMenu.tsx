const ignoreUpdateCheck = async (): Promise<void> => {};

export function useDesktopUpdateMenu(): () => Promise<void> {
  return ignoreUpdateCheck;
}
