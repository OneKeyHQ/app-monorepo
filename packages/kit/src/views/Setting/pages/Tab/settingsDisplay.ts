import type { IKeyOfIcons } from '@onekeyhq/components';

type ISettingsDisplayTitleEntry = {
  title: string;
  mobileTitle?: string;
};

export function getSettingsDisplayTitleKey(
  entry: ISettingsDisplayTitleEntry,
  preferMobileNaming: boolean,
): 'title' | 'mobileTitle' {
  return preferMobileNaming && entry.mobileTitle ? 'mobileTitle' : 'title';
}

/**
 * Display copy rule shared by the sidebar labels, pane headers, and both
 * search pipelines: when `preferMobileNaming` (tab layouts and phones), the
 * optional mobile naming wins; otherwise the canonical title is used. Lives
 * in a leaf module so page components can use it without importing the config
 * module (which imports the pages).
 */
export function getSettingsDisplayTitle(
  entry: ISettingsDisplayTitleEntry,
  preferMobileNaming: boolean,
): string {
  return (
    entry[getSettingsDisplayTitleKey(entry, preferMobileNaming)] || entry.title
  );
}

export function getSettingsDisplayIcon(
  entry: { icon: string | IKeyOfIcons; mobileIcon?: string | IKeyOfIcons },
  preferMobileNaming: boolean,
): string {
  return (preferMobileNaming ? entry.mobileIcon : undefined) || entry.icon;
}
