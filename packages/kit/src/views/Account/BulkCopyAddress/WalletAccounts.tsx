import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  HStack,
  Text,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { DBAccountDerivation } from '@onekeyhq/engine/src/types/accountDerivation';
import WalletAvatar from '@onekeyhq/kit/src/components/WalletSelector/WalletAvatar';
import { getDeviceTypeByDeviceId } from '@onekeyhq/kit/src/utils/hardware';
import { isPassphraseWallet } from '@onekeyhq/shared/src/engine/engineUtils';
import type { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useDerivationPath } from '../../../components/NetworkAccountSelector/hooks/useDerivationPath';
import { useRuntime } from '../../../hooks/redux';

import { formatDerivationLabel } from './helper';

type INetworkDerivation = DBAccountDerivation & { key: string };

const WalletAccounts: FC<{ walletId: string; networkId: string }> = ({
  walletId,
  networkId,
}) => {
  const isSmallScreen = useIsVerticalLayout();
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
        console.log(r.networkDerivations);
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
      <VStack>
        {networkDerivations.map((item) => (
          <HStack>
            <Text>{item.template}</Text>
            <Text>{getDerivationName(item)}</Text>
          </HStack>
        ))}
      </VStack>
    </Box>
  );
};

export default WalletAccounts;
