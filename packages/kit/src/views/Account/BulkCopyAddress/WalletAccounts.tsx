import type { FC } from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import { Box, HStack, Text, VStack } from '@onekeyhq/components';
import type { DBAccountDerivation } from '@onekeyhq/engine/src/types/accountDerivation';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import WalletAvatar from '@onekeyhq/kit/src/components/WalletSelector/WalletAvatar';
import { getDeviceTypeByDeviceId } from '@onekeyhq/kit/src/utils/hardware';
import { isPassphraseWallet } from '@onekeyhq/shared/src/engine/engineUtils';
import type { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useDerivationPath } from '../../../components/NetworkAccountSelector/hooks/useDerivationPath';
import { useRuntime } from '../../../hooks/redux';

import { formatDerivationLabel } from './helper';

type INetworkDerivation = DBAccountDerivation & { key: string };
type IProps = { walletId: string; networkId: string };
export type INetworkDerivationItem = {
  name: string | undefined;
  id: string;
  walletId: string;
  accounts: string[];
  template: string;
  key: string;
};
export type IWalletAccountsReturnType = {
  networkDerivations: INetworkDerivationItem[];
};
export type IWalletAccountsRefType = {
  onSubmit: () => {
    wallet: Wallet | undefined;
  } & IWalletAccountsReturnType;
};

const WalletAccounts = forwardRef<IWalletAccountsRefType, IProps>(
  ({ walletId, networkId }: IProps, ref) => {
    const intl = useIntl();
    const { wallets } = useRuntime();
    const wallet = wallets.find((item) => item.id === walletId);

    const { derivationOptions } = useDerivationPath(walletId, networkId);
    const { serviceDerivationPath } = backgroundApiProxy;
    const [networkDerivations, setNetworkDerivations] = useState<
      INetworkDerivation[]
    >([]);
    useEffect(() => {
      if (!walletId && !networkId) return;
      serviceDerivationPath
        .getNetworkDerivations(walletId, networkId)
        .then((r) => {
          setNetworkDerivations(r.networkDerivations);
        });
    }, [networkId, serviceDerivationPath, walletId]);

    const getDerivationName = useCallback(
      (option: INetworkDerivation) => {
        const derivationOption = derivationOptions.find(
          (item) => item.template === option.template,
        );
        return formatDerivationLabel(intl, derivationOption?.label);
      },
      [derivationOptions, intl],
    );

    const onSubmit = useCallback(
      () => ({
        wallet,
        networkDerivations: networkDerivations.map((i) => ({
          ...i,
          name: getDerivationName(i),
        })),
      }),
      [wallet, networkDerivations, getDerivationName],
    );

    useImperativeHandle(
      ref,
      () => ({
        onSubmit,
      }),
      [onSubmit],
    );

    if (!wallet) {
      return null;
    }

    return (
      <Box>
        <HStack alignItems="center" space={4}>
          <WalletAvatar
            walletImage={wallet.type}
            avatar={wallet.avatar}
            hwWalletType={
              (wallet.deviceType as IOneKeyDeviceType) ||
              getDeviceTypeByDeviceId(wallet.associatedDevice)
            }
            isPassphrase={isPassphraseWallet(wallet)}
            circular
            size="sm"
          />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body1Strong' }}
            color="text-default"
          >
            {wallet.name}
          </Text>
        </HStack>
        <VStack mt={4} mb={6} space={4}>
          {networkDerivations.map((item) => (
            <HStack alignItems="center" justifyContent="space-between">
              <Text typography={{ sm: 'Body2Strong', md: 'Body2Strong' }}>
                {getDerivationName(item)}
              </Text>
              <Text
                typography={{ sm: 'Body2Strong', md: 'Body2Strong' }}
                color="text-subdued"
              >
                {item.accounts.length}{' '}
                {intl.formatMessage({ id: 'title__accounts' })}
              </Text>
            </HStack>
          ))}
        </VStack>
      </Box>
    );
  },
);

WalletAccounts.displayName = 'WalletAccounts';

export default WalletAccounts;
