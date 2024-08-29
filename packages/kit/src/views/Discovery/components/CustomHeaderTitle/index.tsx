import { useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Popover, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
  const displayUrl = activeTabId && tab?.url;
  const { hiddenHttpsUrl } = formatHiddenHttpsUrl(
    displayUrl ? tab?.url : undefined,
  );
  const { hostSecurity, iconConfig } = useUrlRiskConfig(tab?.url);
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
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      onPress={() => handleSearchBarPress(tab?.url ?? '')}
      borderCurve="continuous"
    >
      <Popover
        title="dApp info"
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
              id: ETranslations.explore_search_dapps,
            })}
      </SizableText>
    </XStack>
  );
}

// @ts-expect-error
export default withBrowserProvider<ICustomHeaderTitleProps>(CustomHeaderTitle);
