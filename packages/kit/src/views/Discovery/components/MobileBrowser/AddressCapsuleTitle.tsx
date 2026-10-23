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

// Everything inside the address capsule (menu, site badge, domain, reload)
// shares one 16pt size.
export const ADDRESS_CAPSULE_ICON_SIZE = 16;
const RISK_ICON_SIZE = ADDRESS_CAPSULE_ICON_SIZE;

const styles = StyleSheet.create({
  fill: { flex: 1, alignSelf: 'stretch', overflow: 'hidden' },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
});

// Domain text at a fixed 16pt that is never ellipsized: it lays out at its
// natural width, and when that is wider than the room, the end of the domain
// (the part that identifies the site) stays visible and the start fades out.
function DomainLabel({ text, testID }: { text: string; testID?: string }) {
  const [availableWidth, setAvailableWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const overflows = availableWidth > 0 && textWidth > availableWidth + 0.5;

  const row = (
    <View
      style={[
        styles.row,
        { justifyContent: overflows ? 'flex-end' : 'center' },
      ]}
    >
      <SizableText
        size="$bodyLgMedium"
        flexShrink={0}
        onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
        testID={testID}
      >
        {text}
      </SizableText>
    </View>
  );

  return (
    <View
      style={styles.fill}
      onLayout={(e) => setAvailableWidth(e.nativeEvent.layout.width)}
    >
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
