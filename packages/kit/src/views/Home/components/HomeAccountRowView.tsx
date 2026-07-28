import { memo } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  IconButton,
  SizableText,
  Spinner,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { AccountAvatar } from '../../../components/AccountAvatar';
import { NativeNetworkSelectorPressable } from '../../../components/AccountSelector/NativeNetworkSelectorPressable';
import {
  NetworkAvatar,
  NetworkAvatarBase,
} from '../../../components/NetworkAvatar';

import type { IHomeHeaderAccountPresentation } from '../model/presentation/homeHeaderPresentation';

const MAX_DISPLAY_NETWORKS = 2;

type IHomeAccountRowViewProps = {
  onAccountSelectorPress: () => void;
  onCopyAddressPress: () => void;
  onNetworkSelectorPress: () => void;
  presentation: IHomeHeaderAccountPresentation;
};

const HomeAccountRowView = memo(function HomeAccountRowView({
  onAccountSelectorPress,
  onCopyAddressPress,
  onNetworkSelectorPress,
  presentation,
}: IHomeAccountRowViewProps) {
  const intl = useIntl();
  const {
    account,
    accountName,
    compatibleNetworks,
    compatibleNetworksReady,
    compatibleNetworksWithoutAccountCount,
    copyDisabled,
    dbAccount,
    indexedAccount,
    isAccountSelectorSyncLoading,
    isAllNetworks,
    isOthersWallet,
    network,
    ready,
    wallet,
  } = presentation;
  const hasNoUsableWallet = accountUtils.hasNoUsableWallet({
    account,
    wallet,
  });
  if (hasNoUsableWallet && !ready) {
    return isAccountSelectorSyncLoading ? <Spinner size="small" /> : null;
  }

  const canCopyAddress = Boolean(
    (isAllNetworks && indexedAccount) ||
    (account?.address &&
      !accountUtils.isAllNetworkMockAddress({
        address: account.address,
      })),
  );
  const renderNetworkAvatar = () => {
    if (!isAllNetworks || isOthersWallet) {
      return <NetworkAvatar networkId={network?.id} size="$6" />;
    }
    if (!compatibleNetworksReady) {
      return <Stack h={36} />;
    }
    if (compatibleNetworks.length === 0) {
      return (
        <NetworkAvatarBase
          logoURI={network?.logoURI ?? ''}
          size="$6"
          networkName={network?.name}
          isAllNetworks
        />
      );
    }
    return (
      <XStack alignItems="center">
        {compatibleNetworks
          .slice(0, MAX_DISPLAY_NETWORKS)
          .map((item, index) => (
            <Stack
              key={item.id}
              borderWidth={2}
              borderColor="$bgApp"
              borderRadius="$full"
              zIndex={index}
              {...(index === 0 ? undefined : { ml: '$-2' })}
            >
              <NetworkAvatarBase
                logoURI={item.logoURI}
                size="$6"
                networkName={item.name}
                isCustomNetwork={item.isCustomNetwork}
              />
            </Stack>
          ))}
        {compatibleNetworks.length > MAX_DISPLAY_NETWORKS ? (
          <XStack
            px="$1"
            bg="$gray5"
            borderRadius="$full"
            ml="$-2"
            zIndex={999}
            borderWidth={2}
            borderColor="$bgApp"
            alignItems="center"
            justifyContent="center"
            h={28}
          >
            <SizableText size="$bodySm">
              +{compatibleNetworks.length - MAX_DISPLAY_NETWORKS}
            </SizableText>
          </XStack>
        ) : null}
      </XStack>
    );
  };
  const renderNetworkContent = ({
    nestedInNativePressable,
    pressed,
  }: {
    nestedInNativePressable: boolean;
    pressed: boolean;
  }) => (
    <XStack
      pointerEvents={nestedInNativePressable ? 'none' : undefined}
      alignItems="center"
      borderRadius="$2"
      bg={pressed ? '$bgActive' : undefined}
      hoverStyle={nestedInNativePressable ? undefined : { bg: '$bgHover' }}
      pressStyle={nestedInNativePressable ? undefined : { bg: '$bgActive' }}
      userSelect="none"
      onPress={nestedInNativePressable ? undefined : onNetworkSelectorPress}
    >
      {renderNetworkAvatar()}
      <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$5" />
      {compatibleNetworks.length > 0 &&
      compatibleNetworksWithoutAccountCount > 0 ? (
        <Stack
          position="absolute"
          right="$0"
          top="$0"
          w="$3"
          alignItems="flex-end"
          pointerEvents="none"
        >
          <Stack
            bg="$bgApp"
            borderRadius="$full"
            borderWidth={2}
            borderColor="$transparent"
          >
            <Stack
              px="$1"
              borderRadius="$full"
              bg="$caution10"
              minWidth="$2"
              height="$2"
            />
          </Stack>
        </Stack>
      ) : null}
    </XStack>
  );

  return (
    <XStack flex={1} alignItems="center" justifyContent="space-between">
      <XStack flex={1} minWidth={0} gap="$3" alignItems="center">
        <XStack
          testID="AccountSelectorTriggerBase"
          role="button"
          alignItems="center"
          py="$1"
          px="$1.5"
          mx="$-1.5"
          borderRadius="$2"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          onPress={onAccountSelectorPress}
          userSelect="none"
        >
          <AccountAvatar
            size="small"
            borderRadius="$1"
            indexedAccount={indexedAccount}
            account={account}
            dbAccount={dbAccount}
            wallet={wallet}
          />
          <SizableText
            pl="$2.5"
            size="$bodyLgMedium"
            color="$text"
            numberOfLines={1}
            flexShrink={1}
            maxWidth="$40"
          >
            {accountName ||
              intl.formatMessage({ id: ETranslations.no_account })}
          </SizableText>
          <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
        </XStack>
        {canCopyAddress ? (
          <IconButton
            testID="account-selector-copy-address-btn"
            title={intl.formatMessage({
              id: ETranslations.global_copy_address,
            })}
            icon="Copy3Outline"
            size="small"
            variant="tertiary"
            disabled={copyDisabled}
            allowPressWhenDisabled={copyDisabled}
            onPress={onCopyAddressPress}
          />
        ) : null}
      </XStack>
      {accountName ? (
        <XStack flexShrink={0} alignItems="center">
          {platformEnv.isNativeIOS ? (
            <NativeNetworkSelectorPressable
              accessibilityLabel={network?.name}
              accessibilityRole="button"
              onPress={onNetworkSelectorPress}
              testID="account-network-trigger-button"
            >
              {({ pressed }) =>
                renderNetworkContent({
                  nestedInNativePressable: true,
                  pressed,
                })
              }
            </NativeNetworkSelectorPressable>
          ) : (
            renderNetworkContent({
              nestedInNativePressable: false,
              pressed: false,
            })
          )}
        </XStack>
      ) : null}
    </XStack>
  );
});

export { HomeAccountRowView };
