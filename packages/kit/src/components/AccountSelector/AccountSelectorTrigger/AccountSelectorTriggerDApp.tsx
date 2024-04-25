import { useCallback, useEffect } from 'react';

import {
  Icon,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import {
  useAccountSelectorTrigger,
  useMockAccountSelectorLoading,
} from '../hooks/useAccountSelectorTrigger';

export const AccountSelectorTriggerDappConnection = XStack.styleable<{
  num: number;
  compressionUiMode?: boolean;
  beforeShowTrigger?: () => Promise<void>;
  loadingDuration?: number;
}>(
  (
    {
      num,
      compressionUiMode,
      disabled,
      beforeShowTrigger,
      loadingDuration,
      ...rest
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _: any,
  ) => {
    const { isLoading } = useMockAccountSelectorLoading(loadingDuration);
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

    const accountName = account?.name ? account.name : 'No Account';

    const media = useMedia();
    const isCompressionUiMode = media.md || compressionUiMode;

    const renderAvatar = useCallback(() => {
      if (isLoading) {
        return <Skeleton w="$6" h="$6" />;
      }
      if (account?.address) {
        return (
          <AccountAvatar
            size="small"
            borderRadius="$1"
            account={account}
            networkId={network?.id}
            indexedAccount={indexedAccount}
          />
        );
      }
      return <Icon size="$6" name="XSquareOutline" color="$iconSubdued" />;
    }, [isLoading, account, network?.id, indexedAccount]);

    const renderAccountName = useCallback(() => {
      if (isLoading) {
        if (isCompressionUiMode) {
          return (
            <YStack flex={1} space="$2">
              <Skeleton w={196} h="$4" />
              <Skeleton w={196} h="$4" />
            </YStack>
          );
        }
        return <Skeleton w={118} h="$5" />;
      }
      if (isCompressionUiMode) {
        return (
          <YStack flex={1}>
            <SizableText size="$bodyMd" numberOfLines={1} color="$textSubdued">
              {accountName}
            </SizableText>
            <SizableText size="$bodyMdMedium" numberOfLines={1} color="$text">
              {addressText}
            </SizableText>
          </YStack>
        );
      }
      return (
        <SizableText size="$bodyMd" numberOfLines={1} color="$textSubdued">
          {accountName}
        </SizableText>
      );
    }, [isLoading, accountName, addressText, isCompressionUiMode]);
    const renderAddressText = useCallback(() => {
      if (isLoading && !isCompressionUiMode) {
        return (
          <YStack flex={1}>
            <Skeleton w={196} h="$5" />
          </YStack>
        );
      }
      if (isCompressionUiMode) {
        return null;
      }
      return (
        <SizableText
          flex={1}
          size="$bodyMdMedium"
          numberOfLines={1}
          color="$text"
        >
          {addressText}
        </SizableText>
      );
    }, [isLoading, addressText, isCompressionUiMode]);
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
        borderCurve="continuous"
        onPress={handlePress}
        disabled={disabled}
        {...rest}
      >
        {renderAvatar()}
        {renderAccountName()}
        {renderAddressText()}
        {disabled ? null : (
          <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$5" />
        )}
      </XStack>
    );
  },
);

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
