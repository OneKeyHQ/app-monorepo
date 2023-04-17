import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  CheckBox,
  Divider,
  HStack,
  Icon,
  IconButton,
  List,
  ListItem,
  Skeleton,
  Text,
  Tooltip,
  VStack,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { getUtxoUniqueKey } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityUtxoAccounts';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { ICoinControlListItem } from '@onekeyhq/engine/src/types/utxoAccounts';
import {
  FormatBalance,
  FormatCurrencyTokenOfAccount,
} from '@onekeyhq/kit/src/components/Format';
import BitcoinUsedAddressListItemMenu from '@onekeyhq/kit/src/views/Account/AddNewAccount/BitcoinUsedAddressListItemMenu';

import useFormatDate from '../../../hooks/useFormatDate';

import type { ListRenderItemInfo } from 'react-native';

const ListTableHeader: FC<{
  isAllSelected: boolean;
  triggerAllSelected: (value: boolean) => void;
}> = ({ isAllSelected, triggerAllSelected }) => {
  const intl = useIntl();
  return (
    <ListItem>
      <ListItem.Column>
        <Box
          flexDirection="row"
          alignItems="flex-start"
          justifyContent="flex-start"
        >
          <CheckBox
            w={5}
            isChecked={isAllSelected}
            onChange={() => triggerAllSelected(!isAllSelected)}
          />
        </Box>
      </ListItem.Column>
      <ListItem.Column
        text={{
          label: intl.formatMessage({ id: 'form__address' }),
          labelProps: { typography: 'Subheading', color: 'text-subdued' },
        }}
        flex={1}
      />
      <ListItem.Column
        mr={-2}
        alignItems="flex-end"
        text={{
          label: intl.formatMessage({ id: 'content__amount' }),
          labelProps: {
            typography: 'Subheading',
            textAlign: 'right',
            color: 'text-subdued',
          },
        }}
        flex={1}
      />
      <ListItem.Column>
        <Box w="10px" />
      </ListItem.Column>
    </ListItem>
  );
};

type ICellProps = {
  accountId: string;
  network: Network;
  token?: Token;
  item: ICoinControlListItem;
  selectedUtxos: string[];
  blockTimeMap: Record<string, number>;
  onChange: (item: ICoinControlListItem, isSelected: boolean) => void;
};

const CoinControlCell: FC<ICellProps> = ({
  accountId,
  network,
  token,
  item,
  selectedUtxos = [],
  blockTimeMap,
  onChange,
}) => {
  const { formatDate } = useFormatDate();
  const isSelected = selectedUtxos.find(
    (key) => key === getUtxoUniqueKey(item),
  );
  const showBadge = useMemo(
    () => item.label && item.label.length,
    [item.label],
  );
  const time = useMemo(() => {
    if (!blockTimeMap[item.height]) return '';
    return formatDate(new Date(blockTimeMap[item.height] * 1000), {
      hideTimeForever: true,
    });
  }, [item.height, formatDate, blockTimeMap]);

  return (
    <ListItem
      flex={1}
      space={2}
      onPress={() => {
        onChange(item, !isSelected);
      }}
    >
      <ListItem.Column>
        <Box
          flexDirection="row"
          alignItems="flex-start"
          justifyContent="flex-start"
        >
          <CheckBox
            w={5}
            isChecked={!!isSelected}
            // onChange={(value) => onChange(item, value)}
          />
        </Box>
      </ListItem.Column>
      <ListItem.Column>
        <VStack>
          <Text typography="Body2Strong">{shortenAddress(item.address)}</Text>
          <HStack alignItems="center">
            {time ? (
              <Text typography="Body2" color="text-subdued">
                {time}
              </Text>
            ) : (
              <Skeleton shape="Body2" />
            )}
            {showBadge && (
              <>
                <Text mx={1}>•</Text>
                <Badge
                  size="sm"
                  title={item.label ?? ''}
                  type="default"
                  maxWidth="80px"
                  labelProps={{
                    numberOfLines: 1,
                    maxWidth: '80px',
                  }}
                />
              </>
            )}
          </HStack>
        </VStack>
      </ListItem.Column>
      <ListItem.Column>
        <Box alignItems="flex-end" flex={1} mr={-2} minW="113px">
          <FormatBalance
            balance={new BigNumber(item.value).shiftedBy(-network.decimals)}
            formatOptions={{
              fixed: network.decimals,
            }}
            suffix={network.symbol}
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
          <FormatCurrencyTokenOfAccount
            accountId={accountId}
            networkId={network.id}
            token={token}
            value={new BigNumber(item.value).shiftedBy(-network.decimals)}
            render={(ele) => (
              <Text typography="Body2" color="text-subdued">
                {ele}
              </Text>
            )}
          />
        </Box>
      </ListItem.Column>
      <ListItem.Column>
        <BitcoinUsedAddressListItemMenu>
          <IconButton
            alignItems="flex-end"
            type="plain"
            name="EllipsisVerticalMini"
            color="icon-subdued"
            size="xs"
            hitSlop={12}
            circle
            mr={-2}
          />
        </BitcoinUsedAddressListItemMenu>
      </ListItem.Column>
    </ListItem>
  );
};

const ListFooter: FC<
  Omit<ICellProps, 'item'> & {
    allUtxos: ICoinControlListItem[];
    dustUtxos: ICoinControlListItem[];
  }
> = ({
  allUtxos,
  dustUtxos,
  accountId,
  network,
  token,
  selectedUtxos = [],
  blockTimeMap,
  onChange,
}) => {
  const intl = useIntl();

  const sumUtxoAmount = useMemo(() => {
    const sum = allUtxos.reduce(
      (acc, cur) => acc.plus(cur.value),
      new BigNumber(0),
    );
    return sum.shiftedBy(-network.decimals).toFixed();
  }, [allUtxos, network]);

  const hasDustUtxos = useMemo(() => dustUtxos.length > 0, [dustUtxos]);

  const renderFooterContent = useMemo(
    () =>
      dustUtxos.map((item) => (
        <CoinControlCell
          item={item}
          accountId={accountId}
          network={network}
          token={token}
          selectedUtxos={selectedUtxos}
          blockTimeMap={blockTimeMap}
          onChange={onChange}
        />
      )),
    [
      dustUtxos,
      accountId,
      network,
      token,
      selectedUtxos,
      blockTimeMap,
      onChange,
    ],
  );

  return (
    <Box>
      {hasDustUtxos && (
        <>
          <Divider w="auto" mx={2} />
          <HStack mt={4} mb={2} mx={2}>
            <Tooltip
              label={intl.formatMessage({
                id: 'content__royalty_fees_are_excluded',
              })}
              placement="top left"
            >
              <HStack alignItems="center" space={1} alignSelf="flex-start">
                <Text typography="Subheading" color="text-subdued">
                  {intl.formatMessage({ id: 'form__dust__uppercase' })}
                </Text>
                <Icon
                  name="QuestionMarkCircleMini"
                  size={16}
                  color="icon-subdued"
                />
              </HStack>
            </Tooltip>
          </HStack>
          {renderFooterContent}
        </>
      )}
      <Divider w="auto" mx={2} />
      <HStack
        mt={4}
        mb={2}
        mx={2}
        alignItems="center"
        justifyContent="space-between"
      >
        <Text typography="Subheading" color="text-subdued">
          {allUtxos.length} ITEMS
        </Text>
        <FormatBalance
          balance={sumUtxoAmount}
          formatOptions={{
            fixed: network.decimals,
          }}
          suffix={network.symbol}
          render={(ele) => (
            <Text
              typography="Subheading"
              color="text-subdued"
              textAlign="right"
            >
              {ele}
            </Text>
          )}
        />
      </HStack>
    </Box>
  );
};

const CoinControlList: FC<{
  accountId: string;
  network: Network;
  token?: Token;
  allUtxos: ICoinControlListItem[];
  utxosWithoutDust: ICoinControlListItem[];
  utxosDust: ICoinControlListItem[];
  selectedUtxos: string[];
  isAllSelected: boolean;
  triggerAllSelected: (value: boolean) => void;
  blockTimeMap: Record<string, number>;
  onChange: (item: ICoinControlListItem, isSelected: boolean) => void;
}> = ({
  accountId,
  network,
  token,
  allUtxos,
  utxosWithoutDust,
  utxosDust,
  selectedUtxos,
  isAllSelected,
  triggerAllSelected,
  blockTimeMap,
  onChange,
}) => {
  const rowRenderer = useCallback(
    ({ item }: ListRenderItemInfo<ICoinControlListItem>) => (
      <CoinControlCell
        item={item}
        accountId={accountId}
        network={network}
        token={token}
        selectedUtxos={selectedUtxos}
        blockTimeMap={blockTimeMap}
        onChange={onChange}
      />
    ),
    [selectedUtxos, network, blockTimeMap, token, accountId, onChange],
  );

  const headerComponent = useCallback(
    () => (
      <ListTableHeader
        isAllSelected={isAllSelected}
        triggerAllSelected={triggerAllSelected}
      />
    ),
    [isAllSelected, triggerAllSelected],
  );
  const footerComponent = useCallback(
    () => (
      <ListFooter
        allUtxos={allUtxos}
        dustUtxos={utxosDust}
        accountId={accountId}
        network={network}
        token={token}
        selectedUtxos={selectedUtxos}
        blockTimeMap={blockTimeMap}
        onChange={onChange}
      />
    ),
    [
      allUtxos,
      utxosDust,
      selectedUtxos,
      network,
      blockTimeMap,
      token,
      accountId,
      onChange,
    ],
  );

  return network ? (
    <List
      data={utxosWithoutDust}
      ListHeaderComponent={headerComponent}
      ListFooterComponent={footerComponent}
      renderItem={rowRenderer}
      keyExtractor={(item) => getUtxoUniqueKey(item)}
    />
  ) : null;
};

export { CoinControlList };
