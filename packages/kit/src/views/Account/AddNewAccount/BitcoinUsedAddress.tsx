import type { ComponentProps, FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  IconButton,
  List,
  ListItem,
  Modal,
  Text,
  Token,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import type { Network } from '@onekeyhq/engine/src/types/network';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { FormatBalance } from '../../../components/Format';
import { useNetwork } from '../../../hooks';
import { useRuntime } from '../../../hooks/redux';

import RecoverAccountListItemMenu from './RecoverAccountListItemMenu';

import type {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '../../../routes';
import type { ModalScreenProps } from '../../../routes/types';
import type { RouteProp } from '@react-navigation/native';
import type { ListRenderItemInfo } from 'react-native';

type NavigationProps = ModalScreenProps<CreateAccountRoutesParams>;
type RouteProps = RouteProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.BitcoinUsedAddress
>;

type ListTableHeaderProps = {
  symbol: string;
  showPath: boolean;
} & ComponentProps<typeof Box>;

type IUsedAccount = {
  name: string;
  path: string;
  decimals: number;
  balance: string;
  totalReceived: string;
  displayTotalReceived: string;
};

const ListTableHeader: FC<ListTableHeaderProps> = () => {
  const intl = useIntl();

  return (
    <ListItem p={0} mb="16px">
      <ListItem.Column
        text={{
          label: intl.formatMessage({ id: 'form__address' }),
          labelProps: { typography: 'Subheading', color: 'text-subdued' },
        }}
        flex={1}
      />
      <ListItem.Column
        alignItems="flex-end"
        text={{
          label: 'TOTAL RECEIVED',
          labelProps: {
            typography: 'Subheading',
            textAlign: 'right',
            color: 'text-subdued',
          },
        }}
        flex={1}
      />
      <ListItem.Column>
        <Box w="auto" />
      </ListItem.Column>
    </ListItem>
  );
};

type CellProps = {
  item: IUsedAccount;
  symbol: string | undefined;
  showPath: boolean;
  network: Network | undefined;
} & ComponentProps<typeof Box>;

const AccountCell: FC<CellProps> = ({ item, symbol, network, showPath }) => {
  const displayPath = useMemo(() => '', [network, item]);

  return (
    <ListItem flex={1}>
      <ListItem.Column
        style={{
          // @ts-ignore
          userSelect: 'none',
        }}
        text={{
          label: shortenAddress(item.name),
          labelProps: { w: '120px' },
          description: showPath ? item.path : undefined,
          descriptionProps: { typography: 'Caption', w: '132px' },
          size: 'sm',
        }}
      />
      <ListItem.Column>
        <Box alignItems="flex-end" flex={1}>
          <FormatBalance
            balance={item.displayTotalReceived}
            formatOptions={{
              fixed: item.decimals ?? network?.decimals,
            }}
            suffix={symbol}
            render={(ele) => (
              <Text
                typography={{ sm: 'Body2', md: 'Body2' }}
                style={{
                  // @ts-ignore
                  userSelect: 'none',
                }}
                wordBreak="break-all"
                textAlign="right"
              >
                {ele}
              </Text>
            )}
          />
        </Box>
      </ListItem.Column>
      <ListItem.Column>
        <RecoverAccountListItemMenu item={item} network={network}>
          <IconButton
            alignItems="flex-end"
            type="plain"
            name="EllipsisVerticalMini"
            color="icon-subdued"
            size="xs"
            hitSlop={12}
            circle
          />
        </RecoverAccountListItemMenu>
      </ListItem.Column>
    </ListItem>
  );
};

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
  const { networkId, accountId } = route.params;
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { networks, accounts } = useRuntime();
  const network = networks.find((n) => n.id === networkId);
  const account = accounts.find((i) => i.id === accountId);

  const [config, setConfig] = useState<{ showPath: boolean }>({
    showPath: false,
  });
  const [currentPageData, updateCurrentPageData] = useState<IUsedAccount[]>([]);

  useEffect(() => {
    const res: IUsedAccount[] = [];
    Array.from({ length: 100 }).forEach((_, index) => {
      res.push({
        name: '2N1n8YcwYgf3ng171pLsUyzR7AGqrBSN9Kj',
        path: `m/49'/1'/0'/0/${index}`,
        decimals: 8,
        balance: '291098',
        totalReceived: '41737579',
        displayTotalReceived: new BigNumber('41737579').shiftedBy(-8).toFixed(),
      });
    });
    updateCurrentPageData(res);
  }, []);

  const itemSeparatorComponent = useCallback(
    () => (
      <>
        {!config.showPath && platformEnv.isNative ? <Box h="8px" /> : undefined}
      </>
    ),
    [config.showPath],
  );

  const rowRenderer = useCallback(
    ({ item }: ListRenderItemInfo<IUsedAccount>) => (
      <AccountCell
        network={network}
        symbol={network?.symbol}
        showPath={config.showPath}
        flex={1}
        item={item}
      />
    ),
    [network, config.showPath],
  );
  return (
    <Modal
      header="Addresses"
      headerDescription={
        <UsedAddressHeader
          networkId={networkId}
          accountName={account?.name ?? ''}
        />
      }
    >
      <Box flex={1}>
        <ListTableHeader
          symbol={network?.symbol ?? ''}
          showPath={config.showPath}
        />
        <List
          data={currentPageData}
          renderItem={rowRenderer}
          keyExtractor={(item: IUsedAccount) => `${item.path}`}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={itemSeparatorComponent}
        />
      </Box>
    </Modal>
  );
};

export default BitcoinUsedAddress;
