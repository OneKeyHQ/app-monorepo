import { useIntl } from 'react-intl';

import type { IStackProps } from '@onekeyhq/components';
import { Icon, Shortcut, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveTabId, useWebTabDataById } from '../../hooks/useWebTabs';
import { withBrowserProvider } from '../../pages/Browser/WithBrowserProvider';

interface ICustomHeaderTitleProps {
  handleSearchBarPress: (url: string) => void;
}

const mdHeaderStyle = platformEnv.isNative
  ? ({
      flex: 1,
    } as IStackProps)
  : ({
      // TODO: should patch react-navigation Header Element on Web
      // quick fix react-navigation header on md size of web
      width: 'calc(100vw - 40px)',
      flex: 1,
      mt: '$4',
    } as IStackProps);

function CustomHeaderTitle({ handleSearchBarPress }: ICustomHeaderTitleProps) {
  const intl = useIntl();
  const { activeTabId } = useActiveTabId();
  const { tab } = useWebTabDataById(activeTabId ?? '');
  const displayUrl = activeTabId && tab?.url;

  return (
    <XStack
      role="button"
      alignItems="center"
      px="$2"
      py="$1.5"
      bg="$bgStrong"
      borderRadius="$3"
      minWidth={platformEnv.isNative ? undefined : '$64'}
      $md={mdHeaderStyle}
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
        name={displayUrl ? 'LockOutline' : 'SearchOutline'}
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
          ? tab?.url
          : intl.formatMessage({
              id: ETranslations.explore_search_placeholder,
            })}
      </SizableText>
      {platformEnv.isDesktop ? (
        <Shortcut>
          <Shortcut.Key>⌘</Shortcut.Key>
          <Shortcut.Key>T</Shortcut.Key>
        </Shortcut>
      ) : null}
    </XStack>
  );
}

// @ts-expect-error
export default withBrowserProvider<ICustomHeaderTitleProps>(CustomHeaderTitle);
