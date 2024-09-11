import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useActiveTabId, useWebTabDataById } from '../../hooks/useWebTabs';
import { withBrowserProvider } from '../../pages/Browser/WithBrowserProvider';
import { formatHiddenHttpsUrl } from '../../utils/explorerUtils';

interface ICustomHeaderTitleProps {
  handleSearchBarPress: (url: string) => void;
}

function CustomHeaderTitle({ handleSearchBarPress }: ICustomHeaderTitleProps) {
  const intl = useIntl();
  const { activeTabId } = useActiveTabId();
  const { tab } = useWebTabDataById(activeTabId ?? '');
  const displayUrl = activeTabId && tab?.url;
  const { isHttpsUrl, hiddenHttpsUrl } = formatHiddenHttpsUrl(
    displayUrl ? tab?.url : undefined,
  );

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
      onPress={() => handleSearchBarPress(tab?.url ?? '')}
      borderCurve="continuous"
    >
      <Icon
        name={isHttpsUrl ? 'LockOutline' : 'SearchOutline'}
        size="$5"
        color="$iconSubdued"
      />
      <SizableText
        pl="$2"
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
