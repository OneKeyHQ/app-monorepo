import type { ComponentProps, FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  HStack,
  IconButton,
  List,
  ListItem,
  Modal,
  Spinner,
  Text,
  Token,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import type { BtcForkChainUsedAccount } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { FormatBalance } from '../../../components/Format';
import { useNetwork } from '../../../hooks';
import { useRuntime } from '../../../hooks/redux';

import BitcoinUsedAddressListItemMenu from './BitcoinUsedAddressListItemMenu';
import BitcoinUsedAddressMenu from './BitcoinUsedAddressMenu';
import { showJumpPageDialog } from './JumpPage';

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

const PAGE_SIZE = 50;

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
          label: 'total received',
          labelProps: {
            typography: 'Subheading',
            textAlign: 'right',
            color: 'text-subdued',
          },
        }}
        flex={1}
      />
      <ListItem.Column>
        <Box w="27px" />
      </ListItem.Column>
    </ListItem>
  );
};

type CellProps = {
  item: BtcForkChainUsedAccount;
  symbol: string | undefined;
  showPath: boolean;
  network: Network | undefined;
} & ComponentProps<typeof Box>;

const AccountCell: FC<CellProps> = ({ item, symbol, network, showPath }) => (
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
      <BitcoinUsedAddressListItemMenu
        item={item}
        network={network ?? ({} as Network)}
      >
        <IconButton
          alignItems="flex-end"
          type="plain"
          name="EllipsisVerticalMini"
          color="icon-subdued"
          size="xs"
          hitSlop={12}
          circle
        />
      </BitcoinUsedAddressListItemMenu>
    </ListItem.Column>
  </ListItem>
);

type ListTableFooterProps = {
  currentPage?: number;
  prevButtonDisabled?: boolean;
  nextButtonDisabled?: boolean;
  onPagePress: () => void;
  onNextPagePress: () => void;
  onPrevPagePress: () => void;
};

const ListTableFooter: FC<ListTableFooterProps> = ({
  currentPage,
  prevButtonDisabled,
  nextButtonDisabled,
  onPagePress,
  onNextPagePress,
  onPrevPagePress,
}) => (
  <Center pt={4}>
    <HStack space={0} alignItems="flex-end">
      <Button
        w="40px"
        type="basic"
        borderRightRadius={0}
        leftIconName="ChevronLeftMini"
        onPress={onPrevPagePress}
        isDisabled={prevButtonDisabled}
      />
      <Button
        w={platformEnv.isNative ? 'auto' : '39px'}
        h={platformEnv.isNative ? '37px' : '38px'}
        type="basic"
        onPress={onPagePress}
        isDisabled={false}
        borderLeftWidth={0}
        borderRightWidth={0}
        borderLeftRadius={0}
        borderRightRadius={0}
      >
        <Text maxW="30px" maxH="38px" isTruncated>
          {currentPage}
        </Text>
      </Button>
      <Button
        w="40px"
        type="basic"
        borderLeftRadius={0}
        leftIconName="ChevronRightMini"
        onPress={onNextPagePress}
        isDisabled={nextButtonDisabled}
      />
    </HStack>
  </Center>
);

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

  const maxPage = useMemo(
    () => Math.ceil(dataSource.length / PAGE_SIZE),
    [dataSource],
  );

  const isMaxPage = useMemo(
    () => config.currentPage >= maxPage,
    [config.currentPage, maxPage],
  );

  const currentPageData = useMemo(() => {
    const startIndex = (config.currentPage - 1) * PAGE_SIZE;
    const res = dataSource.slice(startIndex, PAGE_SIZE + startIndex);
    return res;
  }, [config.currentPage, dataSource]);

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

  const itemSeparatorComponent = useCallback(
    () => (
      <>
        {!config.showPath && platformEnv.isNative ? <Box h="8px" /> : undefined}
      </>
    ),
    [config.showPath],
  );

  const rowRenderer = useCallback(
    ({ item }: ListRenderItemInfo<BtcForkChainUsedAccount>) => (
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
      rightContent={
        <BitcoinUsedAddressMenu
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
          <ListTableHeader
            symbol={network?.symbol ?? ''}
            showPath={config.showPath}
          />
          <List
            data={currentPageData}
            renderItem={rowRenderer}
            keyExtractor={(item: BtcForkChainUsedAccount) => `${item.path}`}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={itemSeparatorComponent}
          />
          <ListTableFooter
            currentPage={config.currentPage}
            prevButtonDisabled={config.currentPage === 1}
            nextButtonDisabled={isMaxPage}
            onPagePress={() => {
              showJumpPageDialog({
                currentPage: config.currentPage - 1,
                maxPage,
                onConfirm: (page) => {
                  setConfig((prev) => ({
                    ...prev,
                    currentPage: page,
                  }));
                },
              });
            }}
            onPrevPagePress={() => {
              setConfig((prev) => {
                if (prev.currentPage === 0) return prev;
                return {
                  ...prev,
                  currentPage: prev.currentPage - 1,
                };
              });
            }}
            onNextPagePress={() => {
              setConfig((prev) => {
                if (isMaxPage) return prev;
                return {
                  ...prev,
                  currentPage: prev.currentPage + 1,
                };
              });
            }}
          />
        </Box>
      )}
    </Modal>
  );
};

export default BitcoinUsedAddress;
