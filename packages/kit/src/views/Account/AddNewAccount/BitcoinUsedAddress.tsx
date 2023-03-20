import type { FC } from 'react';
import { useEffect, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  IconButton,
  Modal,
  Spinner,
  Token,
} from '@onekeyhq/components';
import type { BtcForkChainUsedAccount } from '@onekeyhq/engine/src/types/account';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNetwork } from '../../../hooks';
import { useRuntime } from '../../../hooks/redux';

import BitcoinUsedAddressList from './BitcoinUsedAddressList';
import BitcoinUsedAddressMenu from './BitcoinUsedAddressMenu';

import type {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '../../../routes';
import type { ModalScreenProps } from '../../../routes/types';
import type { RouteProp } from '@react-navigation/native';

type NavigationProps = ModalScreenProps<CreateAccountRoutesParams>;
type RouteProps = RouteProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.BitcoinUsedAddress
>;

const UsedAddressHeader: FC<{
  networkId: string;
  accountName: string;
}> = ({ accountName, networkId }) => {
  const { network } = useNetwork({ networkId });
  return (
    <Box>
      <Token
        size={4}
        showInfo
        name={accountName}
        showName
        showTokenVerifiedIcon={false}
        token={{ name: network?.name, logoURI: network?.logoURI }}
        nameProps={{
          typography: { sm: 'Caption', md: 'Caption' },
          color: 'text-subdued',
          ml: '-6px',
        }}
      />
    </Box>
  );
};

const BitcoinUsedAddress: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { networkId, accountId, walletId } = route.params;
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { networks, accounts } = useRuntime();
  const network = networks.find((n) => n.id === networkId);
  const account = accounts.find((i) => i.id === accountId);

  const isFetchingDataRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<{
    showPath: boolean;
    currentPage: number;
  }>({
    showPath: false,
    currentPage: 1,
  });
  const [dataSource, setDataSource] = useState<BtcForkChainUsedAccount[]>([]);

  useEffect(() => {
    if (isFetchingDataRef.current) return;
    isFetchingDataRef.current = false;
    setIsLoading(true);
    backgroundApiProxy.serviceDerivationPath
      .getAllUsedAddress({
        networkId,
        accountId,
      })
      .then((res) => setDataSource(res))
      .finally(() => {
        isFetchingDataRef.current = false;
        setIsLoading(false);
      });
  }, [networkId, accountId]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__addresses' })}
      headerDescription={
        <UsedAddressHeader
          networkId={networkId}
          accountName={account?.name ?? ''}
        />
      }
      rightContent={
        <BitcoinUsedAddressMenu
          walletId={walletId}
          networkId={networkId}
          accountId={accountId}
          showPath={config.showPath}
          onChange={(isChecked) => {
            const newConfig = { ...config, showPath: isChecked };
            setConfig(newConfig);
          }}
        >
          <IconButton
            type="plain"
            size="lg"
            circle
            name="EllipsisVerticalOutline"
          />
        </BitcoinUsedAddressMenu>
      }
      footer={null}
    >
      {isLoading ? (
        <Center flex={1}>
          <Spinner size="lg" />
        </Center>
      ) : (
        <Box flex={1}>
          <BitcoinUsedAddressList
            config={config}
            network={network}
            dataSource={dataSource}
            setConfig={setConfig}
          />
        </Box>
      )}
    </Modal>
  );
};

export default BitcoinUsedAddress;
