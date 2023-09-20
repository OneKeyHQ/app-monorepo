import type { Dispatch, SetStateAction } from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import { Box, Center, Empty, HStack, Text, VStack } from '@onekeyhq/components';
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
type IProps = {
  walletId: string;
  networkId: string;
  setButtonDisabled: Dispatch<SetStateAction<boolean>>;
};
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
  onSubmit: () =>
    | false
    | ({
        wallet: Wallet | undefined;
      } & IWalletAccountsReturnType);
};

const WalletAccounts = forwardRef<IWalletAccountsRefType, IProps>(
  ({ walletId, networkId, setButtonDisabled }: IProps, ref) => {
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
        return formatDerivationLabel(
          intl,
          derivationOption?.label || { id: 'form__bip44_standard' },
        );
      },
      [derivationOptions, intl],
    );

    const isDisabled = useMemo(
      () =>
        !networkDerivations.length ||
        networkDerivations.every((n) => !n.accounts.length),
      [networkDerivations],
    );

    useEffect(() => {
      setButtonDisabled(isDisabled);
    }, [isDisabled, setButtonDisabled]);

    const onSubmit = useCallback(() => {
      if (isDisabled) {
        return false;
      }
      return {
        wallet,
        networkDerivations: networkDerivations.map((i) => ({
          ...i,
          name: getDerivationName(i),
        })),
      };
    }, [wallet, networkDerivations, getDerivationName, isDisabled]);

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
      <Box flex={1}>
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
        {!isDisabled ? (
          <VStack mt={4} mb={6} space={4}>
            {networkDerivations
              .filter((item) => item.accounts.length)
              .map((item) => (
                <HStack alignItems="center" justifyContent="space-between">
                  <Text typography={{ sm: 'Body2Strong', md: 'Body2Strong' }}>
                    {getDerivationName(item)}
                  </Text>
                  <Text
                    typography={{ sm: 'Body2Strong', md: 'Body2Strong' }}
                    color="text-subdued"
                  >
                    {intl.formatMessage(
                      { id: 'form__str_accounts' },
                      { count: item.accounts.length },
                    )}
                  </Text>
                </HStack>
              ))}
          </VStack>
        ) : (
          <Center flex={1}>
            <Empty
              emoji="💳"
              title={intl.formatMessage({
                id: 'empty__no_account_title',
              })}
              subTitle={intl.formatMessage({
                id: 'empty__no_account_desc',
              })}
            />
          </Center>
        )}
      </Box>
    );
  },
);

WalletAccounts.displayName = 'WalletAccounts';

export default WalletAccounts;
