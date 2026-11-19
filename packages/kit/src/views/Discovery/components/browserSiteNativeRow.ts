import { PixelRatio, StyleSheet } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type {
  IdentityRow,
  NativeListTheme,
  RowModel,
  TrailingAccessory,
} from '@onekeyfe/react-native-native-list';

// Matches ListItem (py $2 around a 44pt text block) and the old CELL_HEIGHT.
export const BROWSER_SITE_ROW_HEIGHT = 60;
// One physical pixel on iOS and Android, zero on Web.
const DEVICE_PX = platformEnv.isNative ? 1 / PixelRatio.get() : 0;
// React Native on iOS rounds every text box up to the next physical pixel, so
// the 24pt title and 20pt URL each occupy one extra pixel (24.33/20.33 at 3x).
// Android and Web keep the exact 24/20 line boxes.
const PX = platformEnv.isNativeIOS ? DEVICE_PX : 0;
// Unconstrained ListItem height (History): py 8 + 24.33 + 20.33 on iOS.
export const BROWSER_SITE_AUTO_ROW_HEIGHT = 60 + 2 * PX;
// UIKit places single-line text half a pixel lower than React Native's layout,
// which snaps the rounded-up text boxes up; lift rows and headers one pixel.
const TEXT_OFFSET_Y = platformEnv.isNativeIOS ? -PX : 0;
// DiscoveryIcon size="$10".
const ICON_SIZE = 40;
// DiscoveryIcon borderRadius "$2".
const ICON_RADIUS = 8;

function decodeLogo(logo: string | undefined) {
  if (!logo) return undefined;
  try {
    return decodeURIComponent(logo);
  } catch {
    return logo;
  }
}

// One website entry (bookmark or recently closed tab) as a NativeList identity
// row, reproducing ListItem + DiscoveryIcon: 40pt favicon with an 8pt radius
// and hairline border, $bodyLgMedium title and $bodyMd subdued URL. The
// identity defaults already match ListItem's px $3 / gap $3, and leaving them
// unset keeps the tertiary IconButton -7pt edge adjustments.
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
  height = BROWSER_SITE_ROW_HEIGHT,
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
  height?: number;
}): IdentityRow {
  const uri = decodeLogo(logo);
  return {
    key,
    type: 'identity',
    testID,
    height,
    pressDisabled: editing,
    collapseEmptyTrailing: true,
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
      // Image.Fallback: a full-size globe icon on no fill.
      fallbackIcon: {
        name: 'GlobusOutline',
        tintColor: theme.iconSubdued,
        size: ICON_SIZE,
        backgroundColor: '#00000000',
      },
      backgroundColor: '#00000000',
      borderColor,
      borderWidth: StyleSheet.hairlineWidth,
    },
    leadingAction: editing ? leadingAction : undefined,
    title: title || url,
    titleLines: 1,
    subtitle: url,
    subtitleLines: 1,
    trailing: editing ? trailing : undefined,
    style: {
      // ListItem (alignItems center) centers the favicon, the text block and
      // the edit buttons; the padding leaves exactly the text block's height.
      container: { cornerRadius: 12 },
      verticalPadding: (height - (44 + 2 * PX)) / 2,
      image: { cornerRadius: ICON_RADIUS },
      // ListItem.Text stacks the two lines with no gap.
      lineGap: 0,
      title: {
        fontSize: 16,
        lineHeight: 24 + PX,
        fontWeight: 'medium',
        letterSpacing: 0,
        // SizableText's app-wide default.
        tabularNumbers: true,
        color: theme.primaryText,
        lines: 1,
        truncate: 'tail',
        ...(TEXT_OFFSET_Y ? { offsetY: TEXT_OFFSET_Y } : undefined),
      },
      subtitle: {
        fontSize: 14,
        lineHeight: 20 + PX,
        fontWeight: 'regular',
        letterSpacing: 0,
        // SizableText's app-wide default.
        tabularNumbers: true,
        color: theme.secondaryText,
        lines: 1,
        truncate: 'tail',
        ...(TEXT_OFFSET_Y ? { offsetY: TEXT_OFFSET_Y } : undefined),
      },
    },
  };
}

// SectionList.SectionHeader: h $9, px $5, $headingSm in $textSubdued.
export function buildBrowserSectionHeaderRow({
  key,
  sectionKey,
  title,
  theme,
}: {
  key: string;
  sectionKey: string;
  title: string;
  theme: NativeListTheme;
}): RowModel {
  return {
    key,
    type: 'sectionHeader',
    sectionKey,
    title,
    height: 36,
    pressDisabled: true,
    separator: false,
    style: {
      container: { contentVerticalAlignment: 'top' },
      // The list's 8pt content inset plus 12 gives SectionHeader's 20pt.
      horizontalPadding: 12,
      verticalPadding: DEVICE_PX
        ? Math.floor((36 - (20 + DEVICE_PX)) / 2 / DEVICE_PX + 1e-6) * DEVICE_PX
        : (36 - 20) / 2,
      title: {
        fontSize: 14,
        lineHeight: 20 + DEVICE_PX,
        fontWeight: 'semibold',
        letterSpacing: 0,
        // SizableText's app-wide default.
        tabularNumbers: true,
        color: theme.secondaryText,
        lines: 1,
        truncate: 'tail',
        ...(TEXT_OFFSET_Y ? { offsetY: TEXT_OFFSET_Y } : undefined),
      },
    },
  };
}

// SectionList's default SectionSeparatorComponent: <Stack h="$5" />.
export function buildBrowserSectionSeparatorRow(key: string): RowModel {
  return {
    key,
    type: 'system',
    variant: 'spacer',
    height: 20,
    heightRounding: 'nearest',
    pressDisabled: true,
    separator: false,
  };
}
