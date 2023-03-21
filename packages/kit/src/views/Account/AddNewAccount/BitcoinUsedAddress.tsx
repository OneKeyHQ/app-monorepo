import type { FC } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  IconButton,
  Modal,
  SegmentedControl,
  Spinner,
  Token,
} from '@onekeyhq/components';
import type {
  Account,
  BtcForkChainUsedAccount,
} from '@onekeyhq/engine/src/types/account';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNetwork } from '../../../hooks';
import { useRuntime } from '../../../hooks/redux';
import { deviceUtils } from '../../../utils/hardware';

import {
  BitcoinMannualAddedAddressList,
  BitcoinUsedAddressList,
} from './BitcoinUsedAddressList';
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
  const { networks } = useRuntime();
  const network = networks.find((n) => n.id === networkId);

  const isFetchingDataRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<{
    showPath: boolean;
    usedListCurrentPage: number;
    mannualListCurrentPage: number;
  }>({
    showPath: false,
    usedListCurrentPage: 1,
    mannualListCurrentPage: 1,
  });
  const [dataSource, setDataSource] = useState<BtcForkChainUsedAccount[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSegmentedControl, setShowSegmentedControl] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);

  const refreshAccount = useCallback(async () => {
    const searchAccount = await backgroundApiProxy.engine.getAccount(
      accountId,
      networkId,
    );
    setAccount(searchAccount);
    setShowSegmentedControl(
      Object.keys(searchAccount.customAddresses ?? {}).length > 0,
    );
  }, [accountId, networkId]);

  useEffect(() => {
    if (!account) {
      refreshAccount();
    }
  }, [refreshAccount, account]);

  useEffect(() => {
    if (isFetchingDataRef.current) return;
    isFetchingDataRef.current = true;
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

  const customAddressCache: Record<string, string> = {};
  const fetchAddressBalance = useCallback(
    async (addresses: string[]) => {
      isFetchingDataRef.current = true;
      try {
        if (addresses.every((address) => customAddressCache[address])) {
          return addresses.map((address) => ({
            address,
            balance: customAddressCache[address],
          }));
        }
        const filterAddresses = addresses.filter(
          (addr) => !customAddressCache[addr],
        );
        const data =
          await backgroundApiProxy.serviceDerivationPath.fetchCustomAddressBalance(
            {
              networkId,
              accountId,
              addresses: filterAddresses,
              decimals: network?.decimals ?? 8,
            },
          );
        data.forEach((item) => {
          customAddressCache[item.address] = item.balance;
        });
        return addresses.map((addr) => ({
          address: addr,
          balance: customAddressCache[addr],
        }));
      } catch (e) {
        deviceUtils.showErrorToast(e);
        return [];
      } finally {
        isFetchingDataRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountId, networkId, network?.decimals],
  );

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
          onAddedCustomAddressCallback={refreshAccount}
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
          {showSegmentedControl && (
            <Box mb={4}>
              <SegmentedControl
                values={[
                  intl.formatMessage({ id: 'form__automatic' }),
                  intl.formatMessage({ id: 'form__mannual_added' }),
                ]}
                selectedIndex={selectedIndex}
                onChange={setSelectedIndex}
              />
            </Box>
          )}
          {selectedIndex === 0 && (
            <BitcoinUsedAddressList
              config={config}
              network={network}
              dataSource={dataSource}
              setConfig={setConfig}
            />
          )}
          {selectedIndex === 1 && account && (
            <BitcoinMannualAddedAddressList
              account={account}
              config={config}
              network={network}
              dataSource={dataSource}
              setConfig={setConfig}
              onRequestBalances={fetchAddressBalance}
            />
          )}
        </Box>
      )}
    </Modal>
  );
};

export default BitcoinUsedAddress;
