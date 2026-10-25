import { useMemo, useState } from 'react';

import MaskedView from '@react-native-masked-view/masked-view';
import { useIntl } from 'react-intl';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';

import {
  Icon,
  LinearGradient,
  Popover,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useUrlRiskConfig } from '../../hooks/useUrlRiskConfig';
import { DiscoveryTestIDs } from '../../testIDs';
import { DappInfoPopoverContent } from '../DappInfoPopoverContent';

import {
  CAPSULE_BACK_BUTTON_PULL,
  getDisplayHostname,
  logBrowserChromeAction,
} from './browserChrome';
import { ChromePressable } from './ChromePressable';

// The site badge is the same 20pt icon box as the capsule's menu and reload
// icons, so the three read as one set beside the 16pt domain. Icon sizes are
// tokens: a raw number is looked up as a token key, not as pt.
const RISK_ICON_SIZE = '$5';
const RISK_ICON_WIDTH = 20;
const RISK_ICON_HIT_SLOP = { vertical: 13, horizontal: 6 };

const WIDE_ROW_WIDTH = 10_000;

const styles = StyleSheet.create({
  fill: { flex: 1, alignSelf: 'stretch', overflow: 'hidden' },
  // Wide enough that the domain is laid out on a single line at its natural
  // width; a box sized to the capsule would make Android ellipsize (or clip)
  // and iOS wrap a domain that is even slightly too long for it.
  wideRow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: WIDE_ROW_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
  },
  measure: {
    position: 'absolute',
    width: WIDE_ROW_WIDTH,
    flexDirection: 'row',
    opacity: 0,
  },
});

export const DOMAIN_FONT_SIZE = 16;
const DOMAIN_MIN_FONT_SIZE = 14;

// Margin kept when deciding whether a shrunk domain fits, so one that only
// just fits by the measurements isn't cut by a pixel at the capsule edge.
const DOMAIN_WIDTH_SLACK = 2;

// Picks the font size from the domain's measured widths at the full and the
// minimum size (interpolated in half-point steps, not scaled from one
// measurement: glyph widths don't scale exactly linearly, notably on Android).
function fitDomainText(
  fullWidth: number,
  minWidth: number,
  availableWidth: number,
) {
  if (!availableWidth || !fullWidth || fullWidth <= availableWidth) {
    return {
      fontSize: DOMAIN_FONT_SIZE,
      textWidth: undefined,
      overflows: false,
    };
  }
  const room = availableWidth - DOMAIN_WIDTH_SLACK;
  if (!minWidth || minWidth > room) {
    return {
      fontSize: DOMAIN_MIN_FONT_SIZE,
      textWidth: minWidth ? minWidth + DOMAIN_WIDTH_SLACK : undefined,
      overflows: !!minWidth,
    };
  }
  const widthAt = (size: number) =>
    minWidth +
    ((fullWidth - minWidth) * (size - DOMAIN_MIN_FONT_SIZE)) /
      (DOMAIN_FONT_SIZE - DOMAIN_MIN_FONT_SIZE);
  let fontSize = DOMAIN_FONT_SIZE - 0.5;
  while (fontSize > DOMAIN_MIN_FONT_SIZE && widthAt(fontSize) > room) {
    fontSize -= 0.5;
  }
  return {
    fontSize,
    textWidth: Math.ceil(widthAt(fontSize)) + DOMAIN_WIDTH_SLACK,
    overflows: false,
  };
}

// Domain text that never ends in an ellipsis. At 16pt when it fits; when it
// doesn't, it first shrinks (down to 14pt), and only if it still doesn't fit
// does the end of the domain (the part that identifies the site) stay visible
// while the start fades out.
//
// `trailingBalance` is room reserved after the text so it centers in the
// whole capsule rather than beside the leading badge; it gives way first as
// the text grows, so the badge never pushes a fitting domain into the fade.
function DomainLabel({
  text,
  testID,
  trailingBalance,
}: {
  text: string;
  testID?: string;
  trailingBalance: number;
}) {
  const [availableWidth, setAvailableWidth] = useState(0);
  // Natural single-line widths at the full and the minimum font size.
  const [fullTextWidth, setFullTextWidth] = useState(0);
  const [minTextWidth, setMinTextWidth] = useState(0);
  const { fontSize, textWidth, overflows } = fitDomainText(
    fullTextWidth,
    minTextWidth,
    availableWidth,
  );
  const balance = overflows
    ? 0
    : Math.min(
        trailingBalance,
        Math.max(0, availableWidth - (textWidth ?? fullTextWidth)),
      );

  // The text sits in a row far wider than the capsule, so its own box is
  // never constrained: positioned so the text is centered in the space left
  // of the balance, or, when it overflows, ends at the right edge (its start
  // fades). The capsule clips whatever falls outside.
  const row = (
    <View
      style={[
        styles.wideRow,
        overflows
          ? {
              left: availableWidth - WIDE_ROW_WIDTH,
              justifyContent: 'flex-end',
            }
          : {
              left: (availableWidth - balance - WIDE_ROW_WIDTH) / 2,
              justifyContent: 'center',
            },
      ]}
    >
      <SizableText
        size="$bodyLgMedium"
        fontSize={fontSize}
        numberOfLines={1}
        // Hidden until measured, so a long domain doesn't flash at 16pt
        // (cut with an ellipsis on Android) before its size is picked.
        opacity={fullTextWidth && availableWidth ? 1 : 0}
        testID={testID}
      >
        {text}
      </SizableText>
    </View>
  );

  return (
    <View
      style={styles.fill}
      onLayout={(e) =>
        setAvailableWidth(Math.round(e.nativeEvent.layout.width))
      }
    >
      <View style={styles.measure} pointerEvents="none">
        {/* SizableText does not accept onLayout; the wrapper is the measured box. */}
        <View
          onLayout={(e: LayoutChangeEvent) =>
            setFullTextWidth(Math.ceil(e.nativeEvent.layout.width))
          }
        >
          <SizableText
            size="$bodyLgMedium"
            // The size token is scaled to 14 on narrow Android. Pass the
            // same explicit size the visible text uses, or this probe lies.
            fontSize={DOMAIN_FONT_SIZE}
            numberOfLines={1}
          >
            {text}
          </SizableText>
        </View>
        <View
          onLayout={(e: LayoutChangeEvent) =>
            setMinTextWidth(Math.ceil(e.nativeEvent.layout.width))
          }
        >
          <SizableText
            size="$bodyLgMedium"
            fontSize={DOMAIN_MIN_FONT_SIZE}
            numberOfLines={1}
          >
            {text}
          </SizableText>
        </View>
      </View>
      {overflows ? (
        <MaskedView
          style={styles.fill}
          maskElement={
            <LinearGradient
              flex={1}
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.2, y: 0 }}
            />
          }
        >
          {row}
        </MaskedView>
      ) : (
        row
      )}
    </View>
  );
}

// The address inside the bottom bar capsule: site risk badge (opens site info)
// and, like Safari, only the domain (opens search). The domain is centered in
// the capsule while it fits.
export function AddressCapsuleTitle({
  url,
  onPress,
}: {
  url?: string;
  onPress: () => void;
}) {
  const intl = useIntl();
  const hostname = useMemo(() => getDisplayHostname(url), [url]);
  const { hostSecurity, iconConfig } = useUrlRiskConfig(url);
  const [siteInfoOpen, setSiteInfoOpen] = useState(false);
  // The Popover trigger opens on its own press too, so the open state itself
  // is gated: no site info for an empty tab or an unchecked host.
  const canShowSiteInfo = !!url && !!hostSecurity;
  const domainText = url
    ? hostname
    : intl.formatMessage({
        id: ETranslations.browser_search_dapp_or_enter_url,
      });

  return (
    <XStack flex={1} alignSelf="stretch" alignItems="center">
      <Popover
        title={intl.formatMessage({ id: ETranslations.global_info })}
        open={siteInfoOpen && canShowSiteInfo}
        onOpenChange={(open) => setSiteInfoOpen(open && canShowSiteInfo)}
        renderTrigger={
          <ChromePressable
            disabled={!canShowSiteInfo}
            // The 20pt badge alone is too small a target.
            hitSlop={RISK_ICON_HIT_SLOP}
            accessibilityLabel={intl.formatMessage({
              id: ETranslations.global_info,
            })}
            onPress={() => {
              logBrowserChromeAction('siteInfo', 'toolbar');
              setSiteInfoOpen(true);
            }}
          >
            <Icon
              name={url ? iconConfig.iconName : 'SearchOutline'}
              color={url ? iconConfig.iconColor : '$iconSubdued'}
              size={RISK_ICON_SIZE}
            />
          </ChromePressable>
        }
        renderContent={({ closePopover }) => (
          <DappInfoPopoverContent
            iconConfig={iconConfig}
            hostSecurity={hostSecurity}
            closePopover={closePopover}
          />
        )}
      />
      <ChromePressable fill onPress={onPress} accessibilityLabel={domainText}>
        <XStack flex={1} pl="$2" alignItems="center" justifyContent="center">
          <DomainLabel
            testID={DiscoveryTestIDs.searchBar}
            // Mirrors what sits left of the domain but not right of it (the
            // badge and its gap, less the back button's pull) so the domain
            // centers in the whole capsule.
            trailingBalance={RISK_ICON_WIDTH + 8 - CAPSULE_BACK_BUTTON_PULL}
            text={domainText}
          />
        </XStack>
      </ChromePressable>
    </XStack>
  );
}
