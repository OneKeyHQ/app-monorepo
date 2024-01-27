import { useEffect } from 'react';

import {
  Icon,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/components/src/actions/AccountAvatar';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useAccountSelectorTrigger } from '../hooks/useAccountSelectorTrigger';

export const AccountSelectorTriggerDappConnection = XStack.styleable<{
  num: number;
}>(({ num, disabled, ...rest }) => {
  const {
    activeAccount: { account },
    activeAccountName,
    showAccountSelector,
  } = useAccountSelectorTrigger({ num });

  useEffect(() => {
    console.log('AccountSelectorTriggerDappConnection', ':renderer=====>');
  }, []);

  const addressText = account?.address
    ? accountUtils.shortenAddress({
        address: account.address || '',
      })
    : 'No Address';

  const media = useMedia();
  return (
    <XStack
      flex={1}
      py="$2"
      px="$3"
      space="$2"
      bg="$bgApp"
      alignItems="center"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      focusable={!disabled}
      focusStyle={{
        outlineWidth: 2,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
      }}
      onPress={showAccountSelector}
      {...rest}
    >
      {account?.address ? (
        <AccountAvatar size="$6" borderRadius="$1" account={account} />
      ) : null}
      {media.md ? (
        <YStack flex={1}>
          <SizableText size="$bodyMd" numberOfLines={1} color="$textSubdued">
            {activeAccountName}
          </SizableText>
          <SizableText size="$bodyMdMedium" numberOfLines={1} color="$text">
            {addressText}
          </SizableText>
        </YStack>
      ) : (
        <SizableText size="$bodyMd" numberOfLines={1} color="$textSubdued">
          {activeAccountName}
        </SizableText>
      )}
      {media.md ? null : (
        <SizableText
          flex={1}
          size="$bodyMdMedium"
          numberOfLines={1}
          color="$text"
        >
          {addressText}
        </SizableText>
      )}
      <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
});
