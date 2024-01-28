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
  compressionUiMode?: boolean;
}>(({ num, compressionUiMode, disabled, ...rest }) => {
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
  const isCompressionUiMode = media.md || compressionUiMode;
  return (
    <XStack
      flex={1}
      py="$2"
      px="$3"
      space="$2"
      bg="$bgApp"
      alignItems="center"
      hoverStyle={
        disabled
          ? undefined
          : {
              bg: '$bgHover',
            }
      }
      pressStyle={
        disabled
          ? undefined
          : {
              bg: '$bgActive',
            }
      }
      focusable={!disabled}
      focusStyle={
        disabled
          ? undefined
          : {
              outlineWidth: 2,
              outlineColor: '$focusRing',
              outlineStyle: 'solid',
            }
      }
      onPress={showAccountSelector}
      disabled={disabled}
      {...rest}
    >
      {account?.address ? (
        <AccountAvatar size="$6" borderRadius="$1" account={account} />
      ) : null}
      {isCompressionUiMode ? (
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
      {isCompressionUiMode ? null : (
        <SizableText
          flex={1}
          size="$bodyMdMedium"
          numberOfLines={1}
          color="$text"
        >
          {addressText}
        </SizableText>
      )}
      {disabled ? null : (
        <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$5" />
      )}
    </XStack>
  );
});

export function AccountSelectorTriggerBrowserSingle({ num }: { num: number }) {
  const {
    activeAccount: { account },
    activeAccountName,
    showAccountSelector,
  } = useAccountSelectorTrigger({ num });

  const media = useMedia();

  return (
    <XStack
      role="button"
      p="$1.5"
      mx="$-1.5"
      borderRadius="$2"
      alignItems="center"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      focusable
      focusStyle={{
        outlineWidth: 2,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
      }}
      onPress={showAccountSelector}
    >
      <AccountAvatar size="$6" account={account} />
      {media.gtMd ? (
        <>
          <SizableText pl="$2" size="$bodyMdMedium" numberOfLines={1}>
            {activeAccountName}
          </SizableText>
          <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$5" />
        </>
      ) : null}
    </XStack>
  );
}
