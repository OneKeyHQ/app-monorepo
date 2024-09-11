import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  IconButton,
  NATIVE_HIT_SLOP,
  SizableText,
  Tooltip,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useWalletAddress } from '@onekeyhq/kit/src/views/WalletAddress/hooks/useWalletAddress';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalReceiveParamList } from '@onekeyhq/shared/src/routes';
import {
  EModalReceiveRoutes,
  EModalRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import useListenTabFocusState from '../../hooks/useListenTabFocusState';
import {
  useActiveAccount,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';
import { Spotlight } from '../Spotlight';

import { AccountSelectorCreateAddressButton } from './AccountSelectorCreateAddressButton';

const AllNetworkAccountSelector = ({ num }: { num: number }) => {
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num });
  const [isFocus, setIsFocus] = useState(false);
  const { handleWalletAddress, isEnable } = useWalletAddress({ activeAccount });
  // const { isFirstVisit, tourVisited } = useSpotlight(
  //   ESpotlightTour.createAllNetworks,
  // );
  useListenTabFocusState(
    ETabRoutes.Home,
    async (focus: boolean, hideByModal: boolean) => {
      setIsFocus(!hideByModal);
    },
  );
  if (!isEnable) {
    return null;
  }

  return (
    <Spotlight
      isVisible={isFocus ? !platformEnv.isE2E : undefined}
      message={intl.formatMessage({
        id: ETranslations.spotlight_enable_network_message,
      })}
      tourName={ESpotlightTour.createAllNetworks}
    >
      <IconButton
        title={intl.formatMessage({ id: ETranslations.global_copy_address })}
        variant="tertiary"
        icon="Copy3Outline"
        size="small"
        onPress={handleWalletAddress}
      />
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
  const { isEnable: walletAddressEnable } = useWalletAddress({ activeAccount });
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
    if (!account || !network || !deriveInfo || !wallet) return;
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

  if (walletAddressEnable) {
    return <AllNetworkAccountSelector num={num} />;
  }

  // show address if account has an address
  if (account?.address) {
    return (
      <Tooltip
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
