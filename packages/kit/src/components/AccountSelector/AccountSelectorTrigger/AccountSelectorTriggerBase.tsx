import { Icon, SizableText, XStack } from '@onekeyhq/components';

import { AccountAvatar } from '../../AccountAvatar';
import { useAccountSelectorTrigger } from '../hooks/useAccountSelectorTrigger';

export function AccountSelectorTriggerBase({
  num,
  linkNetwork,
}: {
  num: number;
  linkNetwork?: boolean;
}) {
  const {
    activeAccount: { account, indexedAccount, accountName },
    showAccountSelector,
  } = useAccountSelectorTrigger({ num, linkNetwork });

  return (
    <XStack
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
      maxWidth="$40"
    >
      <AccountAvatar
        size="small"
        borderRadius="$1"
        indexedAccount={indexedAccount}
        account={account}
      />

      <SizableText
        flex={1}
        size="$bodyMdMedium"
        pl="$2"
        pr="$1"
        numberOfLines={1}
      >
        {accountName}
      </SizableText>
      <Icon name="ChevronGrabberVerOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
}
