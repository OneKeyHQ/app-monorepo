import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type {
  IIconButtonProps,
  IPageNavigationProp,
} from '@onekeyhq/components';
import {
  Icon,
  IconButton,
  NATIVE_HIT_SLOP,
  SizableText,
  Tooltip,
  XStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAllNetworkCopyAddressHandler } from '@onekeyhq/kit/src/views/WalletAddress/hooks/useAllNetworkCopyAddressHandler';
import { ALL_NETWORK_ACCOUNT_MOCK_ADDRESS } from '@onekeyhq/shared/src/consts/addresses';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalReceiveParamList } from '@onekeyhq/shared/src/routes';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useCopyAddressWithDeriveType } from '../../hooks/useCopyAccountAddress';
import { useShortcutsOnRouteFocused } from '../../hooks/useShortcutsOnRouteFocused';
import {
  useActiveAccount,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';

import { AccountSelectorCreateAddressButton } from './AccountSelectorCreateAddressButton';

const AllNetworkAccountSelector = ({
  num,
  showCopyButton,
}: {
  num: number;
  showCopyButton: boolean;
}) => {
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num });

  const { isAllNetworkEnabled, handleAllNetworkCopyAddress } =
    useAllNetworkCopyAddressHandler({
      activeAccount,
    });

  if (!isAllNetworkEnabled) {
    return null;
  }

  return showCopyButton ? (
    <Tooltip
      shortcutKey={EShortcutEvents.CopyAddressOrUrl}
      renderContent={intl.formatMessage({
        id: ETranslations.global_copy_address,
      })}
      placement="bottom"
      renderTrigger={
        <XStack
          gap="$2"
          p="$1"
          m="$-1"
          borderRadius="$2"
          hoverStyle={{
            bg: '$bgHover',
          }}
          pressStyle={{
            bg: '$bgActive',
          }}
          focusVisibleStyle={{
            outlineColor: '$focusRing',
            outlineWidth: 2,
            outlineStyle: 'solid',
            outlineOffset: 0,
          }}
          hitSlop={{
            right: 8,
            bottom: 8,
            top: 8,
          }}
          userSelect="none"
          onPress={async () => {
            if (
              await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
                walletId: activeAccount?.wallet?.id ?? '',
              })
            ) {
              return;
            }
            await handleAllNetworkCopyAddress(true);
          }}
        >
          <Icon size="$5" name="Copy3Outline" color="$iconSubdued" />
        </XStack>
      }
    />
  ) : null;

  // const visible = isFirstVisit && isFocus;
  // console.log('AllNetworkAccountSelector____visible', visible);
  // return (
  //   <SpotlightView
  //     visible={visible}
  //     content={
  //       <SizableText size="$bodyMd">
  //         {intl.formatMessage({
  //           id: ETranslations.spotlight_enable_network_message,
  //         })}
  //       </SizableText>
  //     }
  //     onConfirm={tourVisited}
  //   >
  //     <IconButton
  //       title={intl.formatMessage({ id: ETranslations.global_copy_address })}
  //       variant="tertiary"
  //       icon="Copy3Outline"
  //       size="small"
  //       onPress={handleWalletAddress}
  //     />
  //   </SpotlightView>
  // );
};

function CopyButton({
  onPress,
  visible,
}: {
  onPress: IIconButtonProps['onPress'];
  visible: boolean;
}) {
  const intl = useIntl();
  return visible ? (
    <IconButton
      title={intl.formatMessage({
        id: ETranslations.global_copy_address,
      })}
      icon="Copy3Outline"
      size="small"
      variant="tertiary"
      onPress={onPress}
    />
  ) : null;
}

export function AccountSelectorActiveAccountHome({
  num,
  showAccountAddress = true,
  showCopyButton = false,
  showCreateAddressButton = true,
  showNoAddressTip = true,
}: {
  num: number;
  showAccountAddress?: boolean;
  showCopyButton?: boolean;
  showCreateAddressButton?: boolean;
  showNoAddressTip?: boolean;
}) {
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num });
  const copyAddressWithDeriveType = useCopyAddressWithDeriveType();
  const {
    account,
    wallet,
    network,
    indexedAccount,
    vaultSettings,
    deriveInfoItems,
  } = activeAccount;

  const { selectedAccount } = useSelectedAccount({ num });
  const { isAllNetworkEnabled, handleAllNetworkCopyAddress } =
    useAllNetworkCopyAddressHandler({
      activeAccount,
    });
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalReceiveParamList>>();

  const logActiveAccount = useCallback(() => {
    console.log({
      selectedAccount,
      addressDetail: activeAccount?.account?.addressDetail,
      activeAccount,
      walletAvatar: activeAccount?.wallet?.avatar,
    });
    console.log(activeAccount?.wallet?.avatar);
  }, [activeAccount, selectedAccount]);

  const handleAddressOnPress = useCallback(async () => {
    if (!account?.address || !network || !wallet) {
      return;
    }

    if (
      await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
        walletId: wallet.id,
      })
    ) {
      return;
    }

    if (
      wallet?.id &&
      (accountUtils.isHwWallet({
        walletId: wallet?.id,
      }) ||
        accountUtils.isQrWallet({
          walletId: wallet?.id,
        }))
    ) {
      navigation.pushModal(EModalRoutes.ReceiveModal, {
        screen: EModalReceiveRoutes.ReceiveToken,
        params: {
          networkId: network.id,
          accountId: account.id,
          walletId: wallet.id,
        },
      });
    } else if (
      vaultSettings?.mergeDeriveAssetsEnabled &&
      accountUtils.isHdWallet({ walletId: wallet?.id ?? '' })
    ) {
      const defaultDeriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId: network?.id ?? '',
        });

      const { accounts } =
        await backgroundApiProxy.serviceAccount.getAccountsByIndexedAccounts({
          indexedAccountIds: [indexedAccount?.id ?? ''],
          networkId: network?.id ?? '',
          deriveType: defaultDeriveType,
        });

      copyAddressWithDeriveType({
        address: accounts?.[0]?.address || '',
        deriveInfo: deriveInfoItems.find(
          (item) => item.value === defaultDeriveType,
        )?.item,
        networkName: network?.shortname,
      });
    } else {
      let networkName = network?.shortname;
      if (
        network?.isAllNetworks &&
        accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) &&
        account?.createAtNetwork
      ) {
        const createAtNetwork =
          await backgroundApiProxy.serviceNetwork.getNetworkSafe({
            networkId: account.createAtNetwork,
          });
        networkName = createAtNetwork?.shortname ?? networkName;
      }

      copyAddressWithDeriveType({
        address: account.address,
        networkName,
      });
    }
    logActiveAccount();
  }, [
    account?.address,
    account?.createAtNetwork,
    account?.id,
    copyAddressWithDeriveType,
    deriveInfoItems,
    indexedAccount?.id,
    logActiveAccount,
    navigation,
    network,
    vaultSettings?.mergeDeriveAssetsEnabled,
    wallet,
  ]);

  useShortcutsOnRouteFocused(
    EShortcutEvents.CopyAddressOrUrl,
    account?.address === ALL_NETWORK_ACCOUNT_MOCK_ADDRESS
      ? handleAllNetworkCopyAddress
      : handleAddressOnPress,
  );

  if (isAllNetworkEnabled) {
    return (
      <AllNetworkAccountSelector num={num} showCopyButton={showCopyButton} />
    );
  }

  if (accountUtils.isAllNetworkMockAddress({ address: account?.address })) {
    return null;
  }

  // show address if account has an address
  if (account?.address) {
    if (showAccountAddress) {
      return (
        <Tooltip
          shortcutKey={EShortcutEvents.CopyAddressOrUrl}
          renderContent={intl.formatMessage({
            id: ETranslations.global_copy_address,
          })}
          placement="top"
          renderTrigger={
            <XStack
              alignItems="center"
              onPress={handleAddressOnPress}
              py="$1"
              px="$2"
              my="$-1"
              mx="$-2"
              borderRadius="$2"
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              focusable
              focusVisibleStyle={{
                outlineWidth: 2,
                outlineColor: '$focusRing',
                outlineStyle: 'solid',
              }}
              hitSlop={NATIVE_HIT_SLOP}
              userSelect="none"
              testID="account-selector-address"
            >
              {platformEnv.isE2E ? (
                <SizableText
                  testID="account-selector-address-text"
                  size="$bodyMd"
                  width={200}
                >
                  {account?.address}
                </SizableText>
              ) : (
                <SizableText
                  testID="account-selector-address-text"
                  size="$bodyMd"
                >
                  {accountUtils.shortenAddress({ address: account?.address })}
                </SizableText>
              )}
            </XStack>
          }
        />
      );
    }

    return (
      <CopyButton onPress={handleAddressOnPress} visible={showCopyButton} />
    );
  }

  // show nothing if account exists, but has not an address
  if (account) {
    return null;
  }

  if (activeAccount.canCreateAddress && showCreateAddressButton) {
    // show create button if account not exists
    return (
      <AccountSelectorCreateAddressButton
        // autoCreateAddress // use EmptyAccount autoCreateAddress instead
        num={num}
        account={selectedAccount}
        onPressLog={logActiveAccount}
      />
    );
  }

  if (
    !account &&
    selectedAccount.othersWalletAccountId &&
    !selectedAccount.indexedAccountId
  ) {
    return (
      <XStack onPress={() => logActiveAccount()}>
        <SizableText size="$bodyMd" color="$textCaution">
          {intl.formatMessage({ id: ETranslations.global_network_not_matched })}
        </SizableText>
      </XStack>
    );
  }

  return showNoAddressTip ? (
    <XStack onPress={() => logActiveAccount()}>
      <SizableText size="$bodyMd" color="$textCaution">
        {intl.formatMessage({ id: ETranslations.wallet_no_address })}
      </SizableText>
    </XStack>
  ) : null;
}
