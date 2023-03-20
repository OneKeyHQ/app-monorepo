import type { ComponentProps, Dispatch, FC, SetStateAction } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  HStack,
  IconButton,
  List,
  ListItem,
  Text,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import type { BtcForkChainUsedAccount } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { FormatBalance } from '../../../components/Format';

import BitcoinUsedAddressListItemMenu from './BitcoinUsedAddressListItemMenu';
import { showJumpPageDialog } from './JumpPage';

import type { ListRenderItemInfo } from 'react-native';

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
          label: intl.formatMessage({ id: 'form__total_received' }),
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

type IUsedAddressListProps = {
  network?: Network;
  config: {
    showPath: boolean;
    currentPage: number;
  };
  dataSource: BtcForkChainUsedAccount[];
  setConfig: Dispatch<
    SetStateAction<{
      showPath: boolean;
      currentPage: number;
    }>
  >;
};

const BitcoinUsedAddressList: FC<IUsedAddressListProps> = ({
  config,
  network,
  dataSource,
  setConfig,
}) => {
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
    <>
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
      {maxPage > 1 && (
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
      )}
    </>
  );
};

export default BitcoinUsedAddressList;
