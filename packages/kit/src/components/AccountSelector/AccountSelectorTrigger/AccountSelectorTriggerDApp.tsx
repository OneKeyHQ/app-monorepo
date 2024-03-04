import { useCallback, useEffect } from 'react';

import {
  Icon,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useAccountSelectorTrigger } from '../hooks/useAccountSelectorTrigger';

export const AccountSelectorTriggerDappConnection = XStack.styleable<{
  num: number;
  compressionUiMode?: boolean;
  beforeShowTrigger?: () => Promise<void>;
}>(({ num, compressionUiMode, disabled, beforeShowTrigger, ...rest }) => {
  const {
    activeAccount: { account, network, indexedAccount },
    showAccountSelector,
  } = useAccountSelectorTrigger({ num, linkNetwork: true });

  const handlePress = useCallback(async () => {
    await beforeShowTrigger?.();
    showAccountSelector();
  }, [beforeShowTrigger, showAccountSelector]);

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
      userSelect="none"
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
      style={{
        borderCurve: 'continuous',
      }}
      onPress={handlePress}
      disabled={disabled}
      {...rest}
    >
      {account?.address ? (
        <AccountAvatar
          size="small"
          borderRadius="$1"
          account={account}
          networkId={network?.id}
          indexedAccount={indexedAccount}
        />
      ) : null}
      {isCompressionUiMode ? (
        <YStack flex={1}>
          <SizableText size="$bodyMd" numberOfLines={1} color="$textSubdued">
            {account?.name ?? ''}
          </SizableText>
          <SizableText size="$bodyMdMedium" numberOfLines={1} color="$text">
            {addressText}
          </SizableText>
        </YStack>
      ) : (
        <SizableText size="$bodyMd" numberOfLines={1} color="$textSubdued">
          {account?.name ?? ''}
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
    activeAccount: { account, indexedAccount },
    showAccountSelector,
  } = useAccountSelectorTrigger({ num, linkNetwork: true });

  const media = useMedia();

  const handlePress = useCallback(async () => {
    showAccountSelector();
  }, [showAccountSelector]);

  return (
    <XStack
      role="button"
      p="$1.5"
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
      onPress={handlePress}
    >
      <AccountAvatar
        size="small"
        account={account}
        indexedAccount={indexedAccount}
      />
      {media.gtMd ? (
        <>
          <SizableText pl="$2" size="$bodyMdMedium" numberOfLines={1}>
            {account?.name ?? ''}
          </SizableText>
          <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$5" />
        </>
      ) : null}
    </XStack>
  );
}
