import { useIntl } from 'react-intl';

import { Icon, SizableText, View, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IAccountSelectorRouteParamsExtraConfig } from '@onekeyhq/shared/src/routes';

import { AccountAvatar } from '../../AccountAvatar';
import { useAccountSelectorTrigger } from '../hooks/useAccountSelectorTrigger';

export function AccountSelectorTriggerBase({
  num,
  ...others
}: {
  num: number;
} & IAccountSelectorRouteParamsExtraConfig) {
  const {
    activeAccount: { account, dbAccount, indexedAccount, accountName, wallet },
    showAccountSelector,
  } = useAccountSelectorTrigger({ num, ...others });
  const intl = useIntl();

  return (
    <XStack
      testID="AccountSelectorTriggerBase"
      role="button"
      alignItems="center"
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
      maxWidth="$40"
    >
      <AccountAvatar
        size="small"
        borderRadius="$1"
        indexedAccount={indexedAccount}
        account={account}
        dbAccount={dbAccount}
      />

      <View pl="$2" pr="$1">
        <SizableText size="$bodySm" color="$textSubdued">
          {wallet?.name ||
            intl.formatMessage({ id: ETranslations.global_no_wallet })}
        </SizableText>
        <SizableText size="$bodyMdMedium" numberOfLines={1}>
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
