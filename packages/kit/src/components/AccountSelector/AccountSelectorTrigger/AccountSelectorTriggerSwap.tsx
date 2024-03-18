import { Icon, SizableText, XStack } from '@onekeyhq/components';

import { AccountAvatar } from '../../AccountAvatar';
import { useAccountSelectorTrigger } from '../hooks/useAccountSelectorTrigger';

export function AccountSelectorTriggerSwap({ num }: { num: number }) {
  const {
    activeAccount: { account, accountName },
    showAccountSelector,
  } = useAccountSelectorTrigger({ num });
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
      onPress={() => showAccountSelector()}
      maxWidth="$40"
    >
      <AccountAvatar size="$6" borderRadius="$1" account={account} />

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
