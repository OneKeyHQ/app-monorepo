import React, { FC, useCallback, useEffect, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  HStack,
  IconButton,
  Modal,
  Token,
  useIsVerticalLayout,
  useToast,
} from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useManageNetworks } from '../../../hooks';

import { DiscardAlert } from './DiscardAlert';

type ItemRowProps = {
  index: number;
  total: number;
  network: Network;
  onDrag: () => void;
  onFixTop: () => void;
};

const ItemRow: FC<ItemRowProps> = ({
  index,
  total,
  network,
  onDrag,
  onFixTop,
}) => (
  <Box
    bg="surface-default"
    display="flex"
    flexDirection="row"
    justifyContent="space-between"
    alignItems="center"
    p="4"
    borderTopRadius={index === 0 ? '12' : 0}
    borderBottomRadius={total - 1 === index ? '12' : 0}
  >
    <Token
      size={8}
      flex={1}
      token={{
        logoURI: network.logoURI,
        name: network.name,
        symbol: network.name,
      }}
      showInfo
      showDescription={false}
      infoBoxProps={{ flex: 1 }}
    />
    <HStack alignItems="center">
      {index > 0 ? (
        <IconButton
          mr="2"
          type="plain"
          name="ArrowUpOutline"
          iconSize={16}
          onPress={onFixTop}
        />
      ) : null}
      <IconButton
        mr="2"
        type="plain"
        name="MenuOutline"
        iconSize={16}
        onPressIn={() => onDrag()}
      />
    </HStack>
  </Box>
);

// eslint-disable-next-line
type RenderItemProps = { item: Network; index: number; drag: () => void };

export const SortableView: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation();
  const { serviceNetwork } = backgroundApiProxy;
  const refData = useRef({ isDiscard: false });
  const ref = useRef<any>();
  const isSmallScreen = useIsVerticalLayout();
  const [visible, setVisible] = useState(false);
  const { enabledNetworks } = useManageNetworks();
  const [list, setList] = useState<Network[]>(enabledNetworks ?? []);

  const [initialData] = useState(() =>
    JSON.stringify(list.map((i) => [i.id, i.enabled])),
  );

  useEffect(() => {
    setTimeout(() => {
      // hack, delay forceUpdate...
      // eslint-disable-next-line
      ref.current?.forceUpdate();
    }, 500);
  }, [ref]);

  const [networksIdMap] = useState<Record<string, boolean>>(() => {
    const result: Record<string, boolean> = {};
    enabledNetworks.forEach((network) => {
      result[network.id] = network.enabled;
    });
    return result;
  });

  const handleFixTop = useCallback(
    (item: Network) => {
      setList([item, ...list.filter((li) => li.id !== item.id)]);
    },
    [list],
  );

  const renderItem = useCallback(
    ({ item, drag, index }: RenderItemProps) => (
      <ItemRow
        index={index}
        key={item.id}
        total={list.length}
        network={item}
        onDrag={drag}
        onFixTop={() => handleFixTop(item)}
      />
    ),
    [list.length, handleFixTop],
  ) as any;

  const onPromise = useCallback(async () => {
    const data = JSON.stringify(
      list.map((item) => [item.id, networksIdMap[item.id]]),
    );
    if (initialData !== data) {
      await serviceNetwork.updateNetworks(
        list.map((item) => [item.id, networksIdMap[item.id]]),
      );
      toast.show({ title: intl.formatMessage({ id: 'msg__change_saved' }) });
    }
    if (navigation?.canGoBack?.()) {
      refData.current.isDiscard = true;
      navigation.goBack();
    }
  }, [
    networksIdMap,
    list,
    initialData,
    serviceNetwork,
    toast,
    intl,
    navigation,
  ]);

  const onBeforeRemove = useCallback(
    (e) => {
      const data = JSON.stringify(
        list.map((item) => [item.id, networksIdMap[item.id]]),
      );
      if (initialData === data || refData.current.isDiscard) {
        return;
      }
      // eslint-disable-next-line
      e.preventDefault();
      setVisible(true);
    },
    [networksIdMap, list, initialData, refData],
  );

  const onDiscard = useCallback(() => {
    refData.current.isDiscard = true;
    setVisible(false);
    navigation.goBack();
  }, [navigation]);

  useEffect(() => {
    navigation.addListener('beforeRemove', onBeforeRemove);
    return () => {
      navigation.removeListener('beforeRemove', onBeforeRemove);
    };
  }, [onBeforeRemove, navigation]);

  return (
    <>
      <Modal
        header={intl.formatMessage({ id: 'modal__sort' })}
        height="560px"
        hidePrimaryAction
        secondaryActionProps={{
          type: 'primary',
          onPromise,
          w: isSmallScreen ? 'full' : undefined,
        }}
        secondaryActionTranslationId="action__done"
        sortableListProps={{
          showsVerticalScrollIndicator: false,
          ref,
          data: list,
          // eslint-disable-next-line
          keyExtractor: ({ id }: any) => id,
          renderItem,
          // eslint-disable-next-line
          onDragEnd: ({ data }: any) => setList(data),
          ItemSeparatorComponent: () => <Divider />,
          contentContainerStyle: {
            paddingBottom: 24,
            paddingTop: 24,
            paddingLeft: 24,
            paddingRight: 24,
          },
        }}
      />
      <DiscardAlert
        visible={visible}
        onConfirm={onDiscard}
        onClose={() => setVisible(false)}
      />
    </>
  );
};

export default SortableView;
