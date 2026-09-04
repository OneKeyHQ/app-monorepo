import platformEnv from '@onekeyhq/shared/src/platformEnv';

export type ISettingsSectionPresentation = 'flat' | 'mobile' | 'tab';

export const SETTINGS_TAB_HEADER_TITLE_CONTAINER_STYLE = {
  marginStart: 4,
} as const;

export const SETTINGS_PAGE_CONTENT_PADDING_X = platformEnv.isNative
  ? '$5'
  : '$6';

// Raw Settings lists already own a 20px row inset. Web renderers add the
// remaining 4px at the page body; native keeps the platform-standard 20px.
export const SETTINGS_PAGE_BODY_INSET_X = platformEnv.isNative
  ? undefined
  : '$1';

export function resolveSettingsSectionPresentation({
  isMobileLayout,
  isNative,
  isTabNavigator,
}: {
  isMobileLayout: boolean;
  isNative: boolean;
  isTabNavigator: boolean;
}): ISettingsSectionPresentation {
  if (isMobileLayout) {
    return 'mobile';
  }
  // Native iPad uses the tab navigator too, but keeps its platform header and
  // existing flat pane treatment instead of adopting the desktop canvas.
  if (isTabNavigator && !isNative) {
    return 'tab';
  }
  return 'flat';
}

export function resolveSettingsPageBackgroundTokenKey({
  enabled,
  themeName,
}: {
  enabled: boolean;
  themeName?: string | null;
}): 'bgApp' | 'bgSubdued' | undefined {
  if (!enabled) {
    return undefined;
  }
  return themeName?.includes('dark') ? 'bgApp' : 'bgSubdued';
}

export function resolveSettingsHeaderBackgroundTokenKey({
  isNativeIOS,
  pageBackgroundTokenKey,
}: {
  isNativeIOS: boolean;
  pageBackgroundTokenKey: 'bgApp' | 'bgSubdued' | undefined;
}): 'bgApp' | 'bgSubdued' | undefined {
  // Keep native iOS inheriting its navigator style on flat layouts. Custom
  // Web and Android headers need an explicit fallback so breakpoint changes
  // update the existing screen instead of retaining the previous canvas.
  return pageBackgroundTokenKey ?? (isNativeIOS ? undefined : 'bgApp');
}

export function isVisibleSubSettingsItem({
  hasDesktopTab,
  isMobileHome,
  isTabNavigator,
  isMobileLayout,
}: {
  hasDesktopTab: boolean;
  isMobileHome: boolean;
  isTabNavigator: boolean;
  isMobileLayout: boolean;
}): boolean {
  // Sidebar already exposes desktopTab items; keep the source row on
  // extension / narrow web, where that tab does not exist.
  if (isTabNavigator && hasDesktopTab) {
    return false;
  }
  if (!isMobileLayout) {
    return true;
  }
  return !isMobileHome;
}

export function resolveSettingsSectionSurface(
  presentation: ISettingsSectionPresentation,
) {
  if (presentation === 'mobile') {
    return {
      backgroundColor: '$bg' as const,
      borderColor: '$neutral3' as const,
      borderWidthScale: 0,
      borderRadius: '$4' as const,
      borderCurve: undefined,
    };
  }
  if (presentation === 'tab') {
    return {
      backgroundColor: '$bg' as const,
      borderColor: '$neutral3' as const,
      borderWidthScale: 0.5,
      borderRadius: '$3' as const,
      borderCurve: 'continuous' as const,
    };
  }
  return {
    backgroundColor: '$bgSubdued' as const,
    borderColor: '$neutral3' as const,
    borderWidthScale: 1,
    borderRadius: '$2.5' as const,
    borderCurve: undefined,
  };
}
