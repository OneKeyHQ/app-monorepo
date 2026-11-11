import type {
  IdentityRow,
  NativeListTheme,
  TrailingAccessory,
} from '@onekeyfe/react-native-native-list';

export const BROWSER_SITE_ROW_HEIGHT = 60;
const ICON_SIZE = 40;

function decodeLogo(logo: string | undefined) {
  if (!logo) return undefined;
  try {
    return decodeURIComponent(logo);
  } catch {
    return logo;
  }
}

// One website entry (bookmark or recently closed tab) as a NativeList identity
// row: favicon, single-line title and single-line URL.
export function buildBrowserSiteRow({
  key,
  title,
  url,
  logo,
  theme,
  borderColor,
  editing,
  leadingAction,
  trailing,
  testID,
}: {
  key: string;
  title: string;
  url: string;
  logo?: string;
  theme: NativeListTheme;
  borderColor: string;
  editing: boolean;
  leadingAction?: IdentityRow['leadingAction'];
  trailing?: readonly TrailingAccessory[];
  testID?: string;
}): IdentityRow {
  const uri = decodeLogo(logo);
  return {
    key,
    type: 'identity',
    testID,
    height: BROWSER_SITE_ROW_HEIGHT,
    heightRounding: 'nearest',
    pressDisabled: editing,
    separator: false,
    leading: {
      kind: 'token',
      shape: 'rounded',
      // A loading strategy enables the globe fallback when a favicon fails.
      image: uri
        ? {
            uri,
            width: ICON_SIZE,
            height: ICON_SIZE,
            loadingStrategy: 'static',
          }
        : undefined,
      fallbackIcon: {
        name: 'GlobusOutline',
        tintColor: theme.iconSubdued,
        size: ICON_SIZE,
      },
      borderColor,
    },
    leadingAction: editing ? leadingAction : undefined,
    title: title || url,
    titleLines: 1,
    subtitle: url,
    subtitleLines: 1,
    trailing: editing ? trailing : undefined,
    style: {
      container: { cornerRadius: 12 },
      horizontalPadding: 12,
      verticalPadding: 8,
      leadingGap: 12,
      trailingGap: 12,
      title: { lines: 1, truncate: 'tail' },
      subtitle: { lines: 1, truncate: 'tail' },
    },
  };
}
