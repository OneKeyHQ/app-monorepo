import { useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Popover, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useUrlRiskConfig } from '../../hooks/useUrlRiskConfig';
import { useActiveTabId, useWebTabDataById } from '../../hooks/useWebTabs';
import { withBrowserProvider } from '../../pages/Browser/WithBrowserProvider';
import { formatHiddenHttpsUrl } from '../../utils/explorerUtils';
import { DappInfoPopoverContent } from '../DappInfoPopoverContent';

interface ICustomHeaderTitleProps {
  handleSearchBarPress: (url: string) => void;
}

function CustomHeaderTitle({ handleSearchBarPress }: ICustomHeaderTitleProps) {
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

  return (
    <XStack
      role="button"
      alignItems="center"
      px="$2"
      py="$1.5"
      bg="$bgStrong"
      borderRadius="$3"
      $md={{
        flex: 1,
      }}
      $platform-native={{ flex: 1 }}
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      onPress={() => handleSearchBarPress(currentUrl ?? '')}
      borderCurve="continuous"
    >
      <Popover
        title={intl.formatMessage({ id: ETranslations.global_info })}
        open={dappInfoIsOpen}
        onOpenChange={setDappInfoIsOpen}
        renderTrigger={
          <XStack
            onPress={() =>
              (displayUrl?.length ?? 0) > 0 &&
              hostSecurity &&
              setDappInfoIsOpen(true)
            }
          >
            <Icon
              name={!displayUrl ? 'SearchOutline' : iconConfig.iconName}
              color={!displayUrl ? '$iconSubdued' : iconConfig.iconColor}
              size="$5"
            />
          </XStack>
        }
        renderContent={({ closePopover }) => (
          <DappInfoPopoverContent
            iconConfig={iconConfig}
            hostSecurity={hostSecurity}
            closePopover={closePopover}
          />
        )}
      />

      <SizableText
        pl="$2"
        pb="$1"
        size="$bodyLg"
        color="$textSubdued"
        flex={1}
        numberOfLines={1}
        testID="explore-index-search"
      >
        {displayUrl
          ? hiddenHttpsUrl
          : intl.formatMessage({
              id: platformEnv.isWebDappMode
                ? ETranslations.global_search
                : ETranslations.global_search_everything,
            })}
      </SizableText>
    </XStack>
  );
}

export default withBrowserProvider<ICustomHeaderTitleProps>(CustomHeaderTitle);
