/* eslint-disable no-nested-ternary */
import type { FC } from 'react';
import { useLayoutEffect, useMemo } from 'react';

import { Box, Pressable, Skeleton, Text } from '@onekeyhq/components';
import type { IAccount, INetwork, IWallet } from '@onekeyhq/engine/src/types';

import { useActiveWalletAccount, useAppSelector } from '../../../../../hooks';
import { useNativeTokenBalance } from '../../../../../hooks/useTokens';
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
  walletId: string | undefined;
  onLastItemRender?: () => void;
};

const defaultProps = {} as const;

const ListItem: FC<ListItemProps> = ({
  account,
  network,
  label,
  address,
  // balance,
  networkId,
  walletId,
  wallet,
  onLastItemRender,
}) => {
  const accountSelectorMode = useAppSelector(
    (s) => s.accountSelector.accountSelectorMode,
  );

  const nativeBalance = useNativeTokenBalance(network?.id, account.id);

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
      activeWalletId === walletId &&
      activeAccountId === account.id &&
      activeNetworkId === networkId,
    [
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
      onPress={() =>
        onPressChangeAccount({
          accountId: account?.id,
          networkId,
          walletId,
          accountSelectorMode,
        })
      }
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
              <Text typography="Body2" color="text-subdued">
                {address}
              </Text>
              <Box w={1} h={1} m={2} bgColor="icon-disabled" rounded="full" />
              {nativeBalance ? (
                <>
                  <Text typography="Body2" color="text-subdued" isTruncated>
                    {formatAmount(nativeBalance, 6)}
                  </Text>
                  <Text typography="Body2" color="text-subdued" ml="2px">
                    {network?.symbol.toUpperCase()}
                  </Text>
                </>
              ) : (
                <Skeleton shape="Body2" />
              )}
            </Box>
          </Box>
          <AccountItemSelectDropdown
            // key={account?.id}
            wallet={wallet}
            account={account}
            network={network}
          />
        </Box>
      )}
    </Pressable>
  );
};

ListItem.defaultProps = defaultProps;

export default ListItem;
