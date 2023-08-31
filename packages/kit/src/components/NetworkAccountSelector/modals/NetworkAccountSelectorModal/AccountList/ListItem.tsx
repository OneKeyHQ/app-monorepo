/* eslint-disable no-nested-ternary */
import type { FC } from 'react';
import { useLayoutEffect, useMemo } from 'react';

import { Box, Pressable, Skeleton, Text } from '@onekeyhq/components';
import CheckBox from '@onekeyhq/components/src/CheckBox/CheckBox';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import type { IAccount, INetwork, IWallet } from '@onekeyhq/engine/src/types';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { IVaultSettings } from '@onekeyhq/engine/src/vaults/types';

import {
  useAccountTokensBalance,
  useActiveWalletAccount,
  useAppSelector,
} from '../../../../../hooks';
import { formatAmount } from '../../../../../utils/priceUtils';
import ExternalAccountImg from '../../../../../views/ExternalAccount/components/ExternalAccountImg';
import { useAccountSelectorChangeAccountOnPress } from '../../../hooks/useAccountSelectorChangeAccountOnPress';
import { AccountItemSelectDropdown } from '../AccountItemSelectDropdown';

type ListItemProps = {
  label?: string;
  address?: string;
  balance?: string;
  account: IAccount;
  wallet: IWallet;
  network: INetwork | null | undefined;
  networkId: string | undefined;
  networkSettings: IVaultSettings | null | undefined;
  walletId: string | undefined;
  onLastItemRender?: () => void;
  tokenShowBalance?: Token;
  singleSelect?: boolean;
  multiSelect?: boolean;
  hideAccountActions?: boolean;
  selectedAccounts?: string[];
  setSelectedAccounts?: (selectedAccounts: string[]) => void;
  onAccountsSelected?: (selectedAccounts: string[]) => void;
};

const defaultProps = {} as const;

const ListItem: FC<ListItemProps> = ({
  account,
  network,
  networkSettings,
  label,
  address,
  // balance,
  networkId,
  walletId,
  wallet,
  tokenShowBalance,
  singleSelect,
  multiSelect,
  hideAccountActions,
  selectedAccounts,
  setSelectedAccounts,
  onAccountsSelected,
  onLastItemRender,
}) => {
  const accountSelectorMode = useAppSelector(
    (s) => s.accountSelector.accountSelectorMode,
  );

  const closeModal = useModalClose();

  const balances = useAccountTokensBalance(network?.id, account?.id);
  const tokenBalance = useMemo(() => {
    if (tokenShowBalance && !tokenShowBalance.isNative) {
      return balances[tokenShowBalance.tokenIdOnNetwork]?.balance ?? '0';
    }
    return balances?.main?.balance ?? '0';
  }, [balances, tokenShowBalance]);

  const isChecked = selectedAccounts?.includes(account.address);

  // @ts-ignore
  const isLastItem = account?.$isLastItem;
  useLayoutEffect(() => {
    if (isLastItem) {
      onLastItemRender?.();
    }
  }, [isLastItem, onLastItemRender]);

  const {
    walletId: activeWalletId,
    accountId: activeAccountId,
    networkId: activeNetworkId,
  } = useActiveWalletAccount();
  const activeExternalWalletName = useAppSelector(
    (s) => s.general.activeExternalWalletName,
  );
  const isActive = useMemo(
    () =>
      !multiSelect &&
      activeWalletId === walletId &&
      activeAccountId === account.id &&
      activeNetworkId === networkId,
    [
      multiSelect,
      activeWalletId,
      walletId,
      activeAccountId,
      account.id,
      activeNetworkId,
      networkId,
    ],
  );

  const { onPressChangeAccount } = useAccountSelectorChangeAccountOnPress();

  return (
    <Pressable
      onPress={() => {
        if (multiSelect) {
          if (isChecked) {
            setSelectedAccounts?.(
              selectedAccounts?.filter((item) => item !== account.address) ??
                [],
            );
          } else {
            setSelectedAccounts?.([
              ...(selectedAccounts || []),
              account.address,
            ]);
          }
        } else if (singleSelect) {
          closeModal();
          onAccountsSelected?.([account.address]);
        } else {
          onPressChangeAccount({
            accountId: account?.id,
            networkId,
            walletId,
            accountSelectorMode,
          });
        }
      }}
    >
      {({ isHovered, isPressed }) => (
        <Box
          flexDirection="row"
          alignItems="center"
          p={2}
          pr={1.5}
          rounded="xl"
          bgColor={
            isActive
              ? 'surface-selected'
              : isPressed
              ? 'surface-pressed'
              : isHovered
              ? 'surface-hovered'
              : 'transparent'
          }
        >
          <ExternalAccountImg
            mr={3}
            accountId={account?.id}
            walletName={isActive ? activeExternalWalletName : null}
          />

          <Box flex={1} mr={3}>
            <Text typography="Body2Strong" isTruncated numberOfLines={1}>
              {label}
            </Text>
            <Box flexDirection="row">
              {networkSettings?.hiddenAddress ? null : (
                <>
                  <Text typography="Body2" color="text-subdued">
                    {address}
                  </Text>
                  <Box
                    w={1}
                    h={1}
                    m={2}
                    bgColor="icon-disabled"
                    rounded="full"
                  />
                </>
              )}
              {tokenBalance ? (
                <>
                  <Text typography="Body2" color="text-subdued" isTruncated>
                    {formatAmount(tokenBalance, 6)}
                  </Text>
                  <Text typography="Body2" color="text-subdued" ml="2px">
                    {tokenShowBalance
                      ? tokenShowBalance?.symbol.toUpperCase()
                      : network?.symbol.toUpperCase()}
                  </Text>
                </>
              ) : (
                <Skeleton shape="Body2" />
              )}
            </Box>
          </Box>
          {multiSelect ? (
            <Box>
              <CheckBox
                isChecked={isChecked}
                containerStyle={{ mr: 0 }}
                checkBoxProps={{
                  size: 'sm',
                  accessibilityLabel: account.address,
                }}
              />
            </Box>
          ) : null}
          {!hideAccountActions ? (
            <AccountItemSelectDropdown
              // key={account?.id}
              wallet={wallet}
              account={account}
              network={network}
            />
          ) : null}
        </Box>
      )}
    </Pressable>
  );
};

ListItem.defaultProps = defaultProps;

export default ListItem;
