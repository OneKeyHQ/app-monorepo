import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Popover, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useUrlRiskConfig } from '../../hooks/useUrlRiskConfig';
import { useActiveTabId, useWebTabDataById } from '../../hooks/useWebTabs';
import { withBrowserProvider } from '../../pages/Browser/WithBrowserProvider';
import { DiscoveryTestIDs } from '../../testIDs';
import { formatHiddenHttpsUrl } from '../../utils/explorerUtils';
import { DappInfoPopoverContent } from '../DappInfoPopoverContent';
import { getDisplayHostname } from '../MobileBrowser/browserChrome';
import { ChromeTap, chromeOnPress } from '../MobileBrowser/ChromeTap';

interface ICustomHeaderTitleProps {
  handleSearchBarPress: (url: string) => void;
  // Rendered inside a host pill (the mobile bottom address capsule): no own
  // background or press fill, centered compact text.
  embedded?: boolean;
}

function CustomHeaderTitle({
  handleSearchBarPress,
  embedded,
}: ICustomHeaderTitleProps) {
  const intl = useIntl();
  const { activeTabId } = useActiveTabId();
  const { tab } = useWebTabDataById(activeTabId ?? '');
  const currentUrl = tab?.displayUrl ?? tab?.url;
  const displayUrl = activeTabId && currentUrl;
  const { hiddenHttpsUrl } = formatHiddenHttpsUrl(
    displayUrl ? currentUrl : undefined,
  );
  const { hostSecurity, iconConfig } = useUrlRiskConfig(currentUrl);
  const [dappInfoIsOpen, setDappInfoIsOpen] = useState(false);
  // Like Safari, the bottom address capsule shows only the site's domain.
  const label = embedded ? getDisplayHostname(currentUrl) : hiddenHttpsUrl;
  const handleSearchPress = useCallback(
    () => handleSearchBarPress(currentUrl ?? ''),
    [handleSearchBarPress, currentUrl],
  );
  const handleSiteInfoPress = useCallback(() => {
    if ((displayUrl?.length ?? 0) > 0 && hostSecurity) {
      setDappInfoIsOpen(true);
    }
  }, [displayUrl, hostSecurity]);

  return (
    <XStack
      role="button"
      alignItems="center"
      px="$2"
      py="$1.5"
      bg={embedded ? '$transparent' : '$bgStrong'}
      borderRadius="$3"
      $md={{
        flex: 1,
      }}
      $platform-native={{ flex: 1 }}
      justifyContent={embedded ? 'center' : undefined}
      hoverStyle={embedded ? undefined : { bg: '$bgHover' }}
      pressStyle={embedded ? undefined : { bg: '$bgActive' }}
      onPress={chromeOnPress(handleSearchPress)}
      borderCurve="continuous"
    >
      <Popover
        title={intl.formatMessage({ id: ETranslations.global_info })}
        open={dappInfoIsOpen}
        onOpenChange={setDappInfoIsOpen}
        renderTrigger={
          <ChromeTap onPress={handleSiteInfoPress}>
            <XStack onPress={chromeOnPress(handleSiteInfoPress)}>
              <Icon
                name={!displayUrl ? 'SearchOutline' : iconConfig.iconName}
                color={!displayUrl ? '$iconSubdued' : iconConfig.iconColor}
                size="$5"
              />
            </XStack>
          </ChromeTap>
        }
        renderContent={({ closePopover }) => (
          <DappInfoPopoverContent
            iconConfig={iconConfig}
            hostSecurity={hostSecurity}
            closePopover={closePopover}
          />
        )}
      />

      <ChromeTap onPress={handleSearchPress}>
        <SizableText
          pl="$2"
          pb={embedded ? undefined : '$1'}
          size={embedded ? '$bodyLgMedium' : '$bodyLg'}
          color={embedded ? '$text' : '$textSubdued'}
          flex={embedded ? undefined : 1}
          flexShrink={1}
          numberOfLines={1}
          testID={DiscoveryTestIDs.searchBar}
        >
          {displayUrl
            ? label
            : intl.formatMessage({
                id: ETranslations.browser_search_dapp_or_enter_url,
              })}
        </SizableText>
      </ChromeTap>
    </XStack>
  );
}

export default withBrowserProvider<ICustomHeaderTitleProps>(CustomHeaderTitle);
