import { useMemo, useState } from 'react';

import MaskedView from '@react-native-masked-view/masked-view';
import { useIntl } from 'react-intl';
import { StyleSheet, View } from 'react-native';

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

import { getDisplayHostname, logBrowserChromeAction } from './browserChrome';
import { ChromePressable } from './ChromePressable';

// The site badge is the same 20pt icon box as the capsule's menu and reload
// icons, so the three read as one set beside the 16pt domain. Icon sizes are
// tokens: a raw number is looked up as a token key, not as pt.
const RISK_ICON_SIZE = '$5';
const RISK_ICON_WIDTH = 20;

const styles = StyleSheet.create({
  fill: { flex: 1, alignSelf: 'stretch', overflow: 'hidden' },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Wide enough that the domain is measured on a single line at its natural
  // width; iOS would otherwise wrap a too-long domain to fit the capsule.
  measure: {
    position: 'absolute',
    width: 10_000,
    flexDirection: 'row',
    opacity: 0,
  },
});

const DOMAIN_FONT_SIZE = 16;
const DOMAIN_MIN_FONT_SIZE = 14;

// Slack added to a shrunk or overflowing label's box: the text is laid out
// in a box sized from measurements, and a box even a hair too narrow makes
// Android ellipsize it (or iOS wrap it).
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

// Domain text that is never ellipsized. At 16pt when it fits; when it
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

  const row = (
    <View
      style={[
        styles.row,
        {
          justifyContent: overflows ? 'flex-end' : 'center',
          paddingRight: balance,
        },
      ]}
    >
      <SizableText
        size="$bodyLgMedium"
        fontSize={fontSize}
        numberOfLines={1}
        flexShrink={0}
        // A width from the measurements keeps the line whole: it overflows
        // to the left (behind the fade) instead of being ellipsized.
        width={textWidth}
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
        <SizableText
          size="$bodyLgMedium"
          numberOfLines={1}
          onLayout={(e) =>
            setFullTextWidth(Math.ceil(e.nativeEvent.layout.width))
          }
        >
          {text}
        </SizableText>
        <SizableText
          size="$bodyLgMedium"
          fontSize={DOMAIN_MIN_FONT_SIZE}
          numberOfLines={1}
          onLayout={(e) =>
            setMinTextWidth(Math.ceil(e.nativeEvent.layout.width))
          }
        >
          {text}
        </SizableText>
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

  return (
    <XStack flex={1} alignSelf="stretch" alignItems="center">
      <Popover
        title={intl.formatMessage({ id: ETranslations.global_info })}
        open={siteInfoOpen}
        onOpenChange={setSiteInfoOpen}
        renderTrigger={
          <ChromePressable
            disabled={!url || !hostSecurity}
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
      <ChromePressable fill onPress={onPress}>
        <XStack flex={1} pl="$2" alignItems="center" justifyContent="center">
          <DomainLabel
            testID={DiscoveryTestIDs.searchBar}
            trailingBalance={RISK_ICON_WIDTH + 8}
            text={
              url
                ? hostname
                : intl.formatMessage({
                    id: ETranslations.browser_search_dapp_or_enter_url,
                  })
            }
          />
        </XStack>
      </ChromePressable>
    </XStack>
  );
}
