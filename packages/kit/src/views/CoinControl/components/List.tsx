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

import useFormatDate from '../../../hooks/useFormatDate';

import { CoinControlListItemMenu } from './CoinControlListItemMenu';

import type { ListRenderItemInfo } from 'react-native';

const ListTableHeader: FC<{
  showCheckbox: boolean;
  isAllSelected: boolean;
  triggerAllSelected: (value: boolean) => void;
}> = ({ showCheckbox, isAllSelected, triggerAllSelected }) => {
  const intl = useIntl();
  return (
    <ListItem>
      {showCheckbox && (
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
      )}
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

export type ICellProps = {
  accountId: string;
  network: Network;
  token?: Token;
  item: ICoinControlListItem;
  showCheckbox: boolean;
  selectedUtxos: string[];
  blockTimeMap: Record<string, number>;
  showPath: boolean;
  onChange: (item: ICoinControlListItem, isSelected: boolean) => void;
  onConfirmEditLabel: (item: ICoinControlListItem, label: string) => void;
  onFrozenUTXO: (item: ICoinControlListItem, value: boolean) => void;
};

const CoinControlCell: FC<ICellProps> = ({
  accountId,
  network,
  token,
  item,
  showCheckbox,
  selectedUtxos = [],
  blockTimeMap,
  showPath,
  onChange,
  onConfirmEditLabel,
  onFrozenUTXO,
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
      {showCheckbox && (
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
      )}
      <ListItem.Column>
        <VStack>
          <Text typography="Body2Strong">{shortenAddress(item.address)}</Text>
          <HStack alignItems="center">
            {/* eslint-disable-next-line no-nested-ternary */}
            {showPath ? (
              <Text typography="Body2" color="text-subdued">
                {item.path}
              </Text>
            ) : time ? (
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
        <CoinControlListItemMenu
          item={item}
          network={network}
          onConfirmEditLabel={onConfirmEditLabel}
          onFrozenUTXO={onFrozenUTXO}
        >
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
        </CoinControlListItemMenu>
      </ListItem.Column>
    </ListItem>
  );
};

const ListFooter: FC<
  Omit<ICellProps, 'item'> & {
    dataSource: ICoinControlListItem[];
    dustUtxos: ICoinControlListItem[];
  }
> = ({
  dataSource,
  dustUtxos,
  accountId,
  network,
  token,
  showCheckbox,
  selectedUtxos = [],
  blockTimeMap,
  showPath,
  onChange,
  onConfirmEditLabel,
  onFrozenUTXO,
}) => {
  const intl = useIntl();

  const sumUtxoAmount = useMemo(() => {
    const sum = dataSource
      .concat(dustUtxos)
      .reduce((acc, cur) => acc.plus(cur.value), new BigNumber(0));
    return sum.shiftedBy(-network.decimals).toFixed();
  }, [dataSource, dustUtxos, network]);

  const itemLength = useMemo(
    () => dataSource.concat(dustUtxos).length,
    [dataSource, dustUtxos],
  );

  const hasDustUtxos = useMemo(() => dustUtxos.length > 0, [dustUtxos]);

  const renderFooterContent = useMemo(
    () =>
      dustUtxos.map((item) => (
        <CoinControlCell
          item={item}
          accountId={accountId}
          network={network}
          token={token}
          showCheckbox={showCheckbox}
          selectedUtxos={selectedUtxos}
          blockTimeMap={blockTimeMap}
          showPath={showPath}
          onChange={onChange}
          onConfirmEditLabel={onConfirmEditLabel}
          onFrozenUTXO={onFrozenUTXO}
        />
      )),
    [
      dustUtxos,
      accountId,
      network,
      token,
      showCheckbox,
      selectedUtxos,
      blockTimeMap,
      showPath,
      onChange,
      onConfirmEditLabel,
      onFrozenUTXO,
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
                id: 'content__dust_refer_to_very_tiny_amount_of_bitcoin',
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
          {itemLength} ITEMS
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
  dataSource: ICoinControlListItem[];
  utxosDust: ICoinControlListItem[];
  showCheckbox: boolean;
  selectedUtxos: string[];
  isAllSelected: boolean;
  triggerAllSelected: (value: boolean) => void;
  blockTimeMap: Record<string, number>;
  showPath: boolean;
  onChange: (item: ICoinControlListItem, isSelected: boolean) => void;
  onConfirmEditLabel: (item: ICoinControlListItem, label: string) => void;
  onFrozenUTXO: (item: ICoinControlListItem, value: boolean) => void;
}> = ({
  accountId,
  network,
  token,
  dataSource,
  utxosDust,
  showCheckbox,
  selectedUtxos,
  isAllSelected,
  triggerAllSelected,
  blockTimeMap,
  showPath,
  onChange,
  onConfirmEditLabel,
  onFrozenUTXO,
}) => {
  const rowRenderer = useCallback(
    ({ item }: ListRenderItemInfo<ICoinControlListItem>) => (
      <CoinControlCell
        item={item}
        accountId={accountId}
        network={network}
        token={token}
        showCheckbox={showCheckbox}
        selectedUtxos={selectedUtxos}
        blockTimeMap={blockTimeMap}
        showPath={showPath}
        onChange={onChange}
        onConfirmEditLabel={onConfirmEditLabel}
        onFrozenUTXO={onFrozenUTXO}
      />
    ),
    [
      showCheckbox,
      selectedUtxos,
      network,
      blockTimeMap,
      token,
      accountId,
      showPath,
      onChange,
      onConfirmEditLabel,
      onFrozenUTXO,
    ],
  );

  const headerComponent = useCallback(
    () => (
      <ListTableHeader
        showCheckbox={showCheckbox}
        isAllSelected={isAllSelected}
        triggerAllSelected={triggerAllSelected}
      />
    ),
    [showCheckbox, isAllSelected, triggerAllSelected],
  );
  const footerComponent = useCallback(
    () => (
      <ListFooter
        dataSource={dataSource}
        dustUtxos={utxosDust}
        accountId={accountId}
        network={network}
        token={token}
        showCheckbox={showCheckbox}
        selectedUtxos={selectedUtxos}
        blockTimeMap={blockTimeMap}
        showPath={showPath}
        onChange={onChange}
        onConfirmEditLabel={onConfirmEditLabel}
        onFrozenUTXO={onFrozenUTXO}
      />
    ),
    [
      dataSource,
      utxosDust,
      showCheckbox,
      selectedUtxos,
      network,
      blockTimeMap,
      token,
      accountId,
      showPath,
      onChange,
      onConfirmEditLabel,
      onFrozenUTXO,
    ],
  );

  return network ? (
    <List
      data={dataSource}
      ListHeaderComponent={headerComponent}
      ListFooterComponent={footerComponent}
      renderItem={rowRenderer}
      keyExtractor={(item) => getUtxoUniqueKey(item)}
    />
  ) : null;
};

export { CoinControlList };
