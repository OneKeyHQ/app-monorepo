import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  Button,
  Center,
  CheckBox,
  Divider,
  HStack,
  Icon,
  IconButton,
  List,
  ListItem,
  Pressable,
  RichTooltip,
  Skeleton,
  Text,
  VStack,
} from '@onekeyhq/components';
import ListItemSeparator from '@onekeyhq/components/src/List/ListItemSeparator';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { getUtxoUniqueKey } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityUtxoAccounts';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { ICoinControlListItem } from '@onekeyhq/engine/src/types/utxoAccounts';
import {
  FormatBalance,
  FormatCurrencyTokenOfAccount,
} from '@onekeyhq/kit/src/components/Format';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
  listType: 'Available' | 'Frozen';
  accountId: string;
  network: Network;
  token?: Token;
  item: ICoinControlListItem;
  showCheckbox: boolean;
  selectedUtxos: string[];
  blockTimeMap: Record<string, number>;
  showPath: boolean;
  isDust: boolean;
  onChange: (item: ICoinControlListItem, isSelected: boolean) => void;
  onConfirmEditLabel: (item: ICoinControlListItem, label: string) => void;
  onFrozenUTXO: (item: ICoinControlListItem, value: boolean) => void;
};

const CoinControlCell: FC<ICellProps> = ({
  listType,
  accountId,
  network,
  token,
  item,
  showCheckbox,
  selectedUtxos = [],
  blockTimeMap,
  showPath,
  isDust,
  onChange,
  onConfirmEditLabel,
  onFrozenUTXO,
}) => {
  const { formatDate } = useFormatDate();
  const isSelected = selectedUtxos.find(
    (key) => key === getUtxoUniqueKey(item),
  );
  const showBadge = useMemo(
    () => !!(item.label && item.label.length > 0),
    [item.label],
  );
  const time = useMemo(() => {
    if (!blockTimeMap[item.height]) return '';
    return formatDate(new Date(blockTimeMap[item.height] * 1000), {
      hideTimeForever: true,
    });
  }, [item.height, formatDate, blockTimeMap]);

  const showFrozenOption = useMemo(() => {
    if (listType === 'Available') {
      return !showCheckbox;
    }
    if (listType === 'Frozen') {
      return !isDust;
    }
    return true;
  }, [listType, showCheckbox, isDust]);

  return (
    <ListItem
      key={getUtxoUniqueKey(item)}
      flex={1}
      space={2}
      onPress={() => {
        if (item.frozen) return;
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
              onChange={() => {
                if (platformEnv.isNative) {
                  if (item.frozen) return;
                  onChange(item, !isSelected);
                }
              }}
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
                  maxWidth={platformEnv.isNativeAndroid ? '60px' : '80px'}
                  labelProps={{
                    numberOfLines: 1,
                    maxWidth: platformEnv.isNativeAndroid ? '60px' : '80px',
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
          showFrozenOption={showFrozenOption}
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

const ItemSeparator: FC<{ isDustSeparator: boolean }> = ({
  isDustSeparator,
}) => {
  const intl = useIntl();
  if (isDustSeparator) {
    return (
      <>
        <Divider w="auto" mx={2} />
        <HStack mt={4} mb={2} mx={2}>
          <RichTooltip
            // eslint-disable-next-line react/no-unstable-nested-components
            trigger={({ ...props }) => (
              <Pressable {...props}>
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
              </Pressable>
            )}
            bodyProps={{
              children: (
                <Text>
                  {intl.formatMessage({
                    id: 'content__dust_refer_to_very_tiny_amount_of_bitcoin',
                  })}
                </Text>
              ),
            }}
          />
        </HStack>
      </>
    );
  }
  return <ListItemSeparator />;
};

const PageControl: FC<{
  currentPage?: number;
  prevButtonDisabled?: boolean;
  nextButtonDisabled?: boolean;
  onPagePress: () => void;
  onNextPagePress: () => void;
  onPrevPagePress: () => void;
}> = ({
  currentPage,
  prevButtonDisabled,
  nextButtonDisabled,
  onPagePress,
  onNextPagePress,
  onPrevPagePress,
}) => (
  <Center my={8}>
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

const ListFooter: FC<{
  network: Network;
  dataSource: ICoinControlListItem[];
  dustUtxos: ICoinControlListItem[];
}> = ({ dataSource, dustUtxos, network }) => {
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

  return (
    <Box>
      <Divider w="auto" mx={2} />
      <HStack mt={4} mx={2} alignItems="center" justifyContent="space-between">
        <Text typography="Subheading" color="text-subdued">
          {intl.formatMessage(
            { id: 'form__str_items__uppercase' },
            { 0: itemLength },
          )}
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
      <PageControl
        currentPage={1}
        onPagePress={() => {}}
        onNextPagePress={() => {}}
        onPrevPagePress={() => {}}
      />
    </Box>
  );
};

const CoinControlList: FC<{
  type: 'Available' | 'Frozen';
  accountId: string;
  network: Network;
  token?: Token;
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
  type,
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
    ({ item, index, separators }: ListRenderItemInfo<ICoinControlListItem>) => {
      if (index === 1) {
        separators.updateProps('leading', { foo: 'bar' });
      }
      return (
        <CoinControlCell
          listType={type}
          item={item}
          accountId={accountId}
          network={network}
          token={token}
          showCheckbox={showCheckbox}
          selectedUtxos={selectedUtxos}
          blockTimeMap={blockTimeMap}
          showPath={showPath}
          isDust={false}
          onChange={onChange}
          onConfirmEditLabel={onConfirmEditLabel}
          onFrozenUTXO={onFrozenUTXO}
        />
      );
    },
    [
      type,
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
        network={network}
      />
    ),
    [dataSource, utxosDust, network],
  );

  const separator = useCallback(
    ({ leadingItem }: { leadingItem: ICoinControlListItem }) => (
      <ItemSeparator isDustSeparator={!!leadingItem.dustSeparator} />
    ),
    [],
  );

  return network ? (
    <List
      data={dataSource}
      ListHeaderComponent={headerComponent}
      ListFooterComponent={footerComponent}
      ItemSeparatorComponent={separator}
      renderItem={rowRenderer}
      keyExtractor={(item) => getUtxoUniqueKey(item)}
    />
  ) : null;
};

export { CoinControlList };
