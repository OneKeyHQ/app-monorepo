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

// Smaller than the 24pt menu/reload icons beside it, so the address reads as
// content and the end icons as controls.
const RISK_ICON_SIZE = 18;
const DOMAIN_FONT_SIZE = 16;
// Long domains first shrink down to this scale before being truncated.
const DOMAIN_MIN_FONT_SCALE = 0.82;

const styles = StyleSheet.create({
  // Lays the text out at its natural width, off-screen, to measure it.
  measure: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 10_000,
    flexDirection: 'row',
    opacity: 0,
  },
  fill: { flex: 1, alignSelf: 'stretch', overflow: 'hidden' },
  tail: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});

// Domain text that never ellipsizes the end: it first scales the font down,
// and if it still doesn't fit, keeps the end of the domain (the part that
// identifies the site) visible and fades the beginning out.
function DomainLabel({ text, testID }: { text: string; testID?: string }) {
  const [availableWidth, setAvailableWidth] = useState(0);
  const [naturalWidth, setNaturalWidth] = useState(0);
  const scale =
    availableWidth && naturalWidth
      ? Math.max(
          DOMAIN_MIN_FONT_SCALE,
          Math.min(1, availableWidth / naturalWidth),
        )
      : 1;
  const fontSize = Math.round(DOMAIN_FONT_SIZE * scale * 2) / 2;
  const overflows = naturalWidth * scale > availableWidth + 0.5;

  const label = (
    <SizableText
      size="$bodyLgMedium"
      fontSize={fontSize}
      numberOfLines={1}
      flexShrink={0}
      testID={testID}
    >
      {text}
    </SizableText>
  );

  return (
    <View
      style={styles.fill}
      onLayout={(e) => setAvailableWidth(e.nativeEvent.layout.width)}
    >
      <View style={styles.measure} pointerEvents="none">
        <SizableText
          size="$bodyLgMedium"
          fontSize={DOMAIN_FONT_SIZE}
          onLayout={(e) => setNaturalWidth(e.nativeEvent.layout.width)}
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
          <View style={styles.tail}>{label}</View>
        </MaskedView>
      ) : (
        <View style={[styles.tail, { justifyContent: 'center' }]}>{label}</View>
      )}
    </View>
  );
}

// The address inside the bottom bar capsule: site risk badge (opens site info)
// and, like Safari, only the domain (opens search). The domain is centered in
// the capsule; the trailing padding mirrors the badge to balance it.
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
        <XStack
          flex={1}
          px="$2"
          pr={RISK_ICON_SIZE + 8}
          alignItems="center"
          justifyContent="center"
        >
          <DomainLabel
            testID={DiscoveryTestIDs.searchBar}
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
