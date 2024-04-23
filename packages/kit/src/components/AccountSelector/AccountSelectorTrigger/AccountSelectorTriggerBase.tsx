import { Icon, SizableText, View, XStack } from '@onekeyhq/components';
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
    activeAccount: { account, dbAccount, indexedAccount, accountName },
    showAccountSelector,
  } = useAccountSelectorTrigger({ num, ...others });

  return (
    <XStack
      testID="AccountSelectorTriggerBase"
      role="button"
      alignItems="center"
      p="$1.5"
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

      <View>
        <SizableText size="$bodyMdMedium" pl="$2" pr="$1" numberOfLines={1}>
          {accountName || 'No Account'}
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
