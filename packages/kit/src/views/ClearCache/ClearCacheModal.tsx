import type { FC } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, CheckBox, List, Modal, Text } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';

import type { ListRenderItem } from 'react-native';

type ItemType = {
  localeId?: LocaleIds;
  name: string;
  selected?: boolean;
};

const AppCache: ItemType[] = [
  {
    name: 'Transaction',
    localeId: 'form__transaction_history',
    selected: true,
  },
  {
    name: 'Swap',
    localeId: 'form__swap_history',
    selected: true,
  },
  {
    name: 'Token',
    localeId: 'form__token_data',
    selected: true,
  },
  {
    name: 'NFT',
    localeId: 'form__nft_data',
    selected: true,
  },
  {
    name: 'Market',
    localeId: 'form__market_data',
    selected: true,
  },
  {
    name: 'ConnectedSites',
    localeId: 'form__connected_sites',
    selected: true,
  },
];

const ListItem: FC<{ item: ItemType; onPress: () => void }> = ({
  item,
  onPress,
}) => {
  const [checked, setChecked] = useState(true);
  const intl = useIntl();

  return (
    <Box flexDirection="row" justifyContent="space-between">
      <Text typography="Body1Strong">
        {intl.formatMessage({
          id: item.localeId,
        })}
      </Text>
      <CheckBox
        onChange={(isSelected) => {
          setChecked(isSelected);
          onPress();
        }}
        isChecked={checked}
      />
    </Box>
  );
};

const ClearCacheModal = () => {
  const intl = useIntl();
  const modalClose = useModalClose();

  const listData = useRef(AppCache);

  const [flag, updateFlag] = useState(0);

  const selectHandle = useCallback((item: ItemType) => {
    listData.current.forEach((object) => {
      if (item.name === object.name) {
        const selected = object.selected ?? false;
        object.selected = !selected;
        updateFlag((prev) => prev + 1);
      }
    });
  }, []);

  const isDisabled = useMemo(() => {
    const data = listData.current.find((item) => item.selected === true);
    if (data) {
      return false;
    }
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flag]);

  const renderItem: ListRenderItem<ItemType> = useCallback(
    ({ item }) => (
      <ListItem
        item={item}
        onPress={() => {
          selectHandle(item);
        }}
      />
    ),
    [selectHandle],
  );
  const ItemSeparatorComponent = useCallback(() => <Box h="16px" />, []);

  const clearAction = useCallback(
    async () =>
      new Promise((resolve) => {
        listData.current.forEach((item) => {
          if (item.name === 'Transaction') {
            simpleDb.history.clearRawData();
          } else if (item.name === 'Swap') {
            simpleDb.swap.clearRawData();
          } else if (item.name === 'Token') {
            simpleDb.token.clearRawData();
          } else if (item.name === 'NFT') {
            simpleDb.nft.clearRawData();
          } else if (item.name === 'Market') {
            simpleDb.market.clearRawData();
          } else if (item.name === 'ConnectedSites') {
            simpleDb.walletConnect.clearRawData();
          }
        });
        return resolve(true);
      }),
    [],
  );

  return (
    <Modal
      primaryActionTranslationId="action__clear"
      hideSecondaryAction
      header={intl.formatMessage({ id: 'action__clear_cache' })}
      maxHeight="560px"
      height="560px"
      onPrimaryActionPress={() => {
        clearAction();
        modalClose();
      }}
      primaryActionProps={{
        isDisabled,
        // onPromise: clearAction,
      }}
      staticChildrenProps={{ flex: 1 }}
    >
      <List
        p="16px"
        m={0}
        data={listData.current}
        keyExtractor={(item) => String(item.name)}
        renderItem={renderItem}
        ItemSeparatorComponent={ItemSeparatorComponent}
      />
    </Modal>
  );
};

export default ClearCacheModal;
