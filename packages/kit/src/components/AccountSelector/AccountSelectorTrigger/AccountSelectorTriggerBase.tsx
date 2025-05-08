import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IAccountSelectorRouteParamsExtraConfig } from '@onekeyhq/shared/src/routes';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { useShortcutsOnRouteFocused } from '../../../hooks/useShortcutsOnRouteFocused';
import { AccountAvatar } from '../../AccountAvatar';
import { SpotlightView } from '../../Spotlight';
import { useAccountSelectorTrigger } from '../hooks/useAccountSelectorTrigger';

import type { ISpotlightViewProps } from '../../Spotlight';

export function AccountSelectorTriggerBase({
  num,
  spotlightProps,
  horizontalLayout,
  ...others
}: {
  num: number;
  autoWidthForHome?: boolean;
  spotlightProps?: ISpotlightViewProps;
  horizontalLayout?: boolean;
} & IAccountSelectorRouteParamsExtraConfig) {
  const {
    activeAccount: { account, dbAccount, indexedAccount, accountName, wallet },
    showAccountSelector,
  } = useAccountSelectorTrigger({ num, ...others });
  const intl = useIntl();

  const walletName =
    wallet?.name || intl.formatMessage({ id: ETranslations.global_no_wallet });
  const displayAccountName =
    accountName || intl.formatMessage({ id: ETranslations.no_account });
  const content = useMemo(
    () => (
      <XStack
        testID="AccountSelectorTriggerBase"
        role="button"
        alignItems="center"
        width="$full"
        // width="$80"
        // flex={1}
        py="$0.5"
        px="$1.5"
        mx="$-1.5"
        borderRadius="$2"
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
        onPress={showAccountSelector}
        userSelect="none"
      >
        <AccountAvatar
          size="small"
          borderRadius="$1"
          indexedAccount={indexedAccount}
          account={account}
          dbAccount={dbAccount}
        />
        <Stack
          flexDirection={horizontalLayout ? 'row' : 'column'}
          pl="$2"
          flexShrink={1}
          flex={platformEnv.isNative ? undefined : 1}
        >
          {horizontalLayout ? (
            <SizableText
              size="$bodyMd"
              color="$text"
              $gtXl={{
                maxWidth: '56',
              }}
              numberOfLines={1}
              flexShrink={1}
              maxWidth="$40"
            >
              {`${walletName} / ${displayAccountName}`}
            </SizableText>
          ) : (
            <>
              <SizableText
                size="$bodyMd"
                color="$text"
                numberOfLines={horizontalLayout ? undefined : 1}
                flexShrink={1}
              >
                {walletName}
              </SizableText>
              <SizableText
                size="$bodyMd"
                numberOfLines={horizontalLayout ? undefined : 1}
                flexShrink={1}
                testID="account-name"
              >
                {displayAccountName}
              </SizableText>
            </>
          )}
        </Stack>
        <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
      </XStack>
    ),
    [
      account,
      dbAccount,
      displayAccountName,
      horizontalLayout,
      indexedAccount,
      showAccountSelector,
      walletName,
    ],
  );

  useShortcutsOnRouteFocused(
    EShortcutEvents.AccountSelector,
    showAccountSelector,
  );

  return spotlightProps ? (
    <SpotlightView {...spotlightProps}>{content}</SpotlightView>
  ) : (
    content
  );
}
