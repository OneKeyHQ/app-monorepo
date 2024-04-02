import { useIntl } from 'react-intl';

import {
  Icon,
  Shortcut,
  SizableText,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveTabId, useWebTabDataById } from '../../hooks/useWebTabs';
import { withBrowserProvider } from '../../pages/Browser/WithBrowserProvider';

interface ICustomHeaderTitleProps {
  handleSearchBarPress: (url: string) => void;
}
function CustomHeaderTitle({ handleSearchBarPress }: ICustomHeaderTitleProps) {
  const intl = useIntl();
  const media = useMedia();
  const { activeTabId } = useActiveTabId();
  const { tab } = useWebTabDataById(activeTabId ?? '');
  const displayUrl = activeTabId && tab?.url;

  return (
    <XStack
      role="button"
      alignItems="center"
      minWidth="$64"
      px="$2"
      py="$1.5"
      bg="$bgStrong"
      borderRadius="$3"
      // TODO: should path react-navigation Header Element on Web
      $md={
        platformEnv.isRuntimeBrowser
          ? {
              // quick fix react-navigation header on md size of web
              width: 'calc(100vw - 40px)',
              flex: 1,
              mt: '$4',
            }
          : {
              flex: 1,
            }
      }
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
      >
        {displayUrl ? tab?.url : intl.formatMessage({ id: 'form__search' })}
      </SizableText>
      {media.gtMd ? (
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
