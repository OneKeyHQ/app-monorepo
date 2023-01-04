import type { FC } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  IconButton,
  Modal,
  Text,
  ToastManager,
  Token,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useManageNetworks } from '../../../hooks';

import { DiscardAlert } from './DiscardAlert';

type ItemRowProps = {
  index: number;
  total: number;
  network: Network;
  isActive?: boolean;
  onDrag: () => void;
  onFixTop: () => void;
};

const ItemRow: FC<ItemRowProps> = ({
  index,
  network,
  isActive,
  onDrag,
  onFixTop,
}) => (
  <MotiView from={{ scale: 1 }} animate={{ scale: isActive ? 0.8 : 1 }}>
    <Box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      py={2}
    >
      <Token
        size={8}
        token={{
          logoURI: network.logoURI,
          symbol: network.name,
        }}
        showInfo
        showDescription={false}
      />
      <Text typography="Body1Strong" flex={1}>
        {network.name}
      </Text>
      <HStack alignItems="center" space={2}>
        {index > 0 ? (
          <IconButton
            type="plain"
            size="sm"
            circle
            name="ArrowUpTopMini"
            onPress={onFixTop}
          />
        ) : null}
        <IconButton
          type="plain"
          size="sm"
          circle
          name="Bars3Mini"
          onPressIn={() => onDrag()}
        />
      </HStack>
    </Box>
  </MotiView>
);

// eslint-disable-next-line
type RenderItemProps = {
  item: Network;
  getIndex: () => number;
  drag: () => void;
  isActive: boolean;
};

export const SortableView: FC = () => {
  const intl = useIntl();

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
    (props: RenderItemProps) => {
      const { item, drag, isActive, getIndex } = props;
      const index = getIndex();
      return (
        <ItemRow
          index={index}
          key={item.id}
          total={list.length}
          network={item}
          isActive={isActive}
          onDrag={drag}
          onFixTop={() => handleFixTop(item)}
        />
      );
    },
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
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__change_saved' }),
      });
    }
    if (navigation?.canGoBack?.()) {
      refData.current.isDiscard = true;
      navigation.goBack();
    }
  }, [networksIdMap, list, initialData, serviceNetwork, intl, navigation]);

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
        secondaryActionTranslationId="action__save"
        sortableListProps={{
          showsVerticalScrollIndicator: false,
          ref,
          data: list,
          // eslint-disable-next-line
          keyExtractor: ({ id }: any) => id,
          renderItem,
          // eslint-disable-next-line
          onDragEnd: ({ data }: any) => setList(data),
          contentContainerStyle: {
            paddingHorizontal: isSmallScreen ? 16 : 24,
            paddingVertical: isSmallScreen ? 8 : 16,
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
