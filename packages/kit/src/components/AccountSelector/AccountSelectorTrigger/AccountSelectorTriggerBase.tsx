import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  View,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IAccountSelectorRouteParamsExtraConfig } from '@onekeyhq/shared/src/routes';

import { AccountAvatar } from '../../AccountAvatar';
import { useAccountSelectorTrigger } from '../hooks/useAccountSelectorTrigger';

export function AccountSelectorTriggerBase({
  num,
  autoWidthForHome,
  ...others
}: {
  num: number;
  autoWidthForHome?: boolean;
} & IAccountSelectorRouteParamsExtraConfig) {
  const {
    activeAccount: { account, dbAccount, indexedAccount, accountName, wallet },
    showAccountSelector,
  } = useAccountSelectorTrigger({ num, ...others });
  const intl = useIntl();
  const media = useMedia();

  const maxWidth = useMemo(() => {
    if (autoWidthForHome) {
      if (media.gtLg) {
        return '$80';
      }
      if (media.sm) {
        return '$60';
      }
      if (media.md) {
        return '$48';
      }
    }
    return '$48';
  }, [autoWidthForHome, media.gtLg, media.md, media.sm]);

  return (
    <XStack
      testID="AccountSelectorTriggerBase"
      role="button"
      alignItems="center"
      maxWidth={maxWidth}
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
      <View
        pl="$2"
        pr="$1"
        minWidth={0}
        // flex={1}
        flex={platformEnv.isNative ? undefined : 1}
      >
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          {wallet?.name ||
            intl.formatMessage({ id: ETranslations.global_no_wallet })}
        </SizableText>
        <SizableText
          size="$bodyMdMedium"
          numberOfLines={1}
          testID="account-name"
        >
          {accountName || intl.formatMessage({ id: ETranslations.no_account })}
        </SizableText>
      </View>
      <Icon
        flexShrink={0} // Prevents the icon from shrinking when the text is too long
        name="ChevronGrabberVerOutline"
        size="$5"
        color="$iconSubdued"
      />
    </XStack>
  );
}
