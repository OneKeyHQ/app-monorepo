import type { FC } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Empty,
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
import { useCopyAddress } from '../../../hooks/useCopyAddress';
import { deviceUtils } from '../../../utils/hardware';

import {
  BitcoinMannualAddedAddressList,
  BitcoinUsedAddressList,
} from './BitcoinUsedAddressList';
import BitcoinUsedAddressMenu from './BitcoinUsedAddressMenu';

import type { CreateAccountRoutesParams } from '../../../routes';
import type { CreateAccountModalRoutes } from '../../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/native';

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
  const { networkId, accountId, walletId, entry } = route.params;
  const { networks, wallets } = useRuntime();
  const network = networks.find((n) => n.id === networkId);
  const wallet = wallets.find((w) => w.id === walletId);

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
  const [selectedIndex, setSelectedIndex] = useState(
    entry === 'manageAccount' ? 1 : 0,
  );
  const [showSegmentedControl, setShowSegmentedControl] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);

  const { copyAddress } = useCopyAddress({ wallet, account, network });

  const refreshAccount = useCallback(async () => {
    const searchAccount = await backgroundApiProxy.engine.getAccount(
      accountId,
      networkId,
    );
    setAccount(searchAccount);
    const hasCustomAddresses =
      Object.keys(JSON.parse(searchAccount.customAddresses ?? '{}')).length > 0;
    setShowSegmentedControl(hasCustomAddresses);
    if (!hasCustomAddresses && selectedIndex === 1) {
      setSelectedIndex(0);
    }
  }, [accountId, networkId, selectedIndex]);

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

  const onCopyAddress = useCallback(
    ({ address, path }: { address: string; path: string }) => {
      copyAddress({ address, template: account?.template, customPath: path });
    },
    [copyAddress, account?.template],
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
      height="640px"
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
          onAddedCustomAddressCallback={() => {
            refreshAccount();
            setTimeout(() => setSelectedIndex(1));
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
          {selectedIndex === 0 &&
            (dataSource.length > 0 ? (
              <BitcoinUsedAddressList
                config={config}
                network={network}
                dataSource={dataSource}
                setConfig={setConfig}
                onCopyAddress={onCopyAddress}
              />
            ) : (
              <Center flex={1}>
                <Empty
                  emoji="💳"
                  title={intl.formatMessage({
                    id: 'title__no_used_addresses',
                  })}
                />
              </Center>
            ))}
          {selectedIndex === 1 && account && (
            <BitcoinMannualAddedAddressList
              account={account}
              config={config}
              network={network}
              dataSource={dataSource}
              setConfig={setConfig}
              onRequestBalances={fetchAddressBalance}
              onRefreshAccount={refreshAccount}
              onCopyAddress={onCopyAddress}
            />
          )}
        </Box>
      )}
    </Modal>
  );
};

export default BitcoinUsedAddress;
