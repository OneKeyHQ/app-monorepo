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
    activeAccount: { account, dbAccount, indexedAccount, accountName },
    showAccountSelector,
  } = useAccountSelectorTrigger({ num, linkNetwork });

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

      <SizableText
        flex={1}
        size="$bodyMdMedium"
        pl="$2"
        pr="$1"
        numberOfLines={1}
      >
        {accountName || 'No Account'}
      </SizableText>
      <Icon
        flexShrink={0} // Prevents the icon from shrinking when the text is too long
        name="ChevronGrabberVerOutline"
        size="$5"
        color="$iconSubdued"
      />
    </XStack>
  );
}
