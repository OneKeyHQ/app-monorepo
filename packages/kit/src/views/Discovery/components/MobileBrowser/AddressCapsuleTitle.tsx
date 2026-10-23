import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Popover, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useUrlRiskConfig } from '../../hooks/useUrlRiskConfig';
import { DiscoveryTestIDs } from '../../testIDs';
import { DappInfoPopoverContent } from '../DappInfoPopoverContent';

import { getDisplayHostname } from './browserChrome';
import { ChromePressable } from './ChromePressable';

const RISK_ICON_SIZE = 20;

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
            onPress={() => setSiteInfoOpen(true)}
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
          <SizableText
            size="$bodyLgMedium"
            numberOfLines={1}
            testID={DiscoveryTestIDs.searchBar}
          >
            {url
              ? hostname
              : intl.formatMessage({
                  id: ETranslations.browser_search_dapp_or_enter_url,
                })}
          </SizableText>
        </XStack>
      </ChromePressable>
    </XStack>
  );
}
