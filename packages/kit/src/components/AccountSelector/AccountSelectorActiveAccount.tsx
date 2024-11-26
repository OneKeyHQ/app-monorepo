import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Icon,
  NATIVE_HIT_SLOP,
  SizableText,
  Skeleton,
  Tooltip,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAllNetworkCopyAddressHandler } from '@onekeyhq/kit/src/views/WalletAddress/hooks/useAllNetworkCopyAddressHandler';
import { ALL_NETWORK_ACCOUNT_MOCK_ADDRESS } from '@onekeyhq/shared/src/consts/addresses';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalReceiveParamList } from '@onekeyhq/shared/src/routes';
import {
  EModalReceiveRoutes,
  EModalRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../hooks/useListenTabFocusState';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useShortcutsOnRouteFocused } from '../../hooks/useShortcutsOnRouteFocused';
import {
  useAccountOverviewStateAtom,
  useAllNetworksStateStateAtom,
} from '../../states/jotai/contexts/accountOverview';
import {
  useActiveAccount,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';
import { Spotlight } from '../Spotlight';

import { AccountSelectorCreateAddressButton } from './AccountSelectorCreateAddressButton';

const AllNetworkAccountSelector = ({ num }: { num: number }) => {
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num });
  const shouldClearAllNetworksCache = useRef(false);
  const [allNetworksState] = useAllNetworksStateStateAtom();
  const [overviewState] = useAccountOverviewStateAtom();

  const [isFocus, setIsFocus] = useState(false);
  const { isAllNetworkEnabled, handleAllNetworkCopyAddress } =
    useAllNetworkCopyAddressHandler({
      activeAccount,
    });
  useListenTabFocusState(
    ETabRoutes.Home,
    async (focus: boolean, hideByModal: boolean) => {
      setIsFocus(!hideByModal);
    },
  );

  const { result: allNetworksCount, run } = usePromiseResult(async () => {
    const { network, wallet } = activeAccount;
    if (!network?.isAllNetworks) return null;

    if (shouldClearAllNetworksCache.current) {
      await backgroundApiProxy.serviceNetwork.clearNetworkVaultSettingsCache();
    }

    const { networkIds } =
      await backgroundApiProxy.serviceNetwork.getAllNetworkIds({
        clearCache: shouldClearAllNetworksCache.current,
      });
    const { networkIdsCompatible } =
      await backgroundApiProxy.serviceNetwork.getNetworkIdsCompatibleWithWalletId(
        {
          walletId: wallet?.id,
          networkIds,
        },
      );

    shouldClearAllNetworksCache.current = false;
    return networkIdsCompatible.length;
  }, [activeAccount]);

  useEffect(() => {
    const reloadAllNetworks = () => {
      shouldClearAllNetworksCache.current = true;
      void run();
    };
    appEventBus.on(
      EAppEventBusNames.NetworkDeriveTypeChanged,
      reloadAllNetworks,
    );
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, reloadAllNetworks);
    appEventBus.on(EAppEventBusNames.AddedCustomNetwork, reloadAllNetworks);
    return () => {
      appEventBus.off(
        EAppEventBusNames.NetworkDeriveTypeChanged,
        reloadAllNetworks,
      );
      appEventBus.off(EAppEventBusNames.AddedCustomNetwork, reloadAllNetworks);
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, reloadAllNetworks);
    };
  }, [run]);

  if (!isAllNetworkEnabled) {
    return null;
  }

  return (
    <Spotlight
      delayMs={150}
      isVisible={isFocus ? !platformEnv.isE2E : undefined}
      message={intl.formatMessage({
        id: ETranslations.spotlight_enable_network_message,
      })}
      tourName={ESpotlightTour.createAllNetworks}
    >
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
        onPress={handleAllNetworkCopyAddress}
      >
        <Icon size="$5" name="Copy3Outline" color="$iconSubdued" />
        {overviewState.initialized ? (
          <SizableText size="$bodyMd">
            {`${allNetworksState.visibleCount ?? 0} / ${allNetworksCount ?? 0}`}
          </SizableText>
        ) : (
          <Skeleton h="$5" w="$10" />
        )}
      </XStack>
      {/* <SizableText size="$bodyMd">{activeAccount?.account?.id}</SizableText> */}
    </Spotlight>
  );

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

export function AccountSelectorActiveAccountHome({ num }: { num: number }) {
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num });
  const { copyText } = useClipboard();
  const { account, wallet, network, deriveInfo } = activeAccount;

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

  const handleAddressOnPress = useCallback(() => {
    if (!account?.address || !network || !deriveInfo || !wallet) {
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
    } else {
      copyText(account.address);
    }
    logActiveAccount();
  }, [
    account,
    copyText,
    deriveInfo,
    logActiveAccount,
    navigation,
    network,
    wallet,
  ]);

  useShortcutsOnRouteFocused(
    EShortcutEvents.CopyAddressOrUrl,
    account?.address === ALL_NETWORK_ACCOUNT_MOCK_ADDRESS
      ? handleAllNetworkCopyAddress
      : handleAddressOnPress,
  );

  if (isAllNetworkEnabled) {
    return <AllNetworkAccountSelector num={num} />;
  }

  if (accountUtils.isAllNetworkMockAddress({ address: account?.address })) {
    return null;
  }

  // show address if account has an address
  if (account?.address) {
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

  // show nothing if account exists, but has not an address
  if (account) {
    return null;
  }

  if (activeAccount.canCreateAddress) {
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

  return (
    <XStack onPress={() => logActiveAccount()}>
      <SizableText size="$bodyMd" color="$textCaution">
        {intl.formatMessage({ id: ETranslations.wallet_no_address })}
      </SizableText>
    </XStack>
  );
}
