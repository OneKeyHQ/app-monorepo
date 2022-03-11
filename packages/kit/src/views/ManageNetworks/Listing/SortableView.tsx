import React, { FC, useCallback, useEffect, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  IconButton,
  Image,
  Modal,
  Switch,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useManageNetworks } from '../../../hooks';
import { useActiveWalletAccount } from '../../../hooks/redux';

import { DiscardAlert } from './DiscardAlert';

type SortableViewProps = {
  onPress: () => void;
};

type ItemRowProps = {
  initialValue: boolean;
  network: Network;
  onDrag: () => void;
  onChange?: (networkid: string, enabled: boolean) => void;
};

const ItemRow: FC<ItemRowProps> = ({
  initialValue,
  network,
  onDrag,
  onChange,
}) => {
  const [isChecked, setChecked] = useState(initialValue);
  const onToggle = useCallback(() => {
    setChecked(!isChecked);
    onChange?.(network.id, !isChecked);
  }, [onChange, isChecked, network.id]);
  return (
    <Box
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      p="4"
    >
      <Box display="flex" flexDirection="row" alignItems="center">
        <IconButton
          mr="2"
          type="plain"
          name="MenuOutline"
          iconSize={16}
          onPressIn={() => onDrag()}
        />
        <Box display="flex" flexDirection="row" alignItems="center">
          <Image
            alt="logoURI"
            size={{ base: 8, md: 6 }}
            source={{ uri: network.logoURI }}
            mr="3"
          />
          <Typography.Body1Strong mr="3">
            {network.shortName}
          </Typography.Body1Strong>
        </Box>
      </Box>
      <Switch isChecked={isChecked} labelType="false" onToggle={onToggle} />
    </Box>
  );
};

// eslint-disable-next-line
type RenderItemProps = { item: Network; drag: () => void };

export const SortableView: FC<SortableViewProps> = ({ onPress }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { serviceNetwork } = backgroundApiProxy;
  const refData = useRef({ isDiscard: false });
  const ref = useRef<any>();
  const isSmallScreen = useIsVerticalLayout();
  const [visible, setVisible] = useState(false);
  const { network: activeNetwork } = useActiveWalletAccount();
  const { allNetworks } = useManageNetworks();
  const [list, setList] = useState<Network[]>(
    (allNetworks ?? []).filter((i) => i.id !== activeNetwork?.network.id),
  );

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
    allNetworks.forEach((network) => {
      result[network.id] = network.enabled;
    });
    return result;
  });

  const onChange = useCallback(
    (networkid: string, enabled: boolean) => {
      networksIdMap[networkid] = enabled;
    },
    [networksIdMap],
  );

  const renderItem = useCallback(
    ({ item, drag }: RenderItemProps) => (
      <ItemRow
        key={item.id}
        network={item}
        initialValue={networksIdMap[item.id]}
        onDrag={drag}
        onChange={onChange}
      />
    ),
    [onChange, networksIdMap],
  ) as any;

  const onPromise = useCallback(async () => {
    const data = JSON.stringify(
      list.map((item) => [item.id, networksIdMap[item.id]]),
    );
    if (initialData !== data) {
      await serviceNetwork.updateNetworks(
        list.map((item) => [item.id, networksIdMap[item.id]]),
      );
    }
    onPress?.();
  }, [networksIdMap, list, onPress, initialData, serviceNetwork]);

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
        header={intl.formatMessage({ id: 'action__customize_network' })}
        height="560px"
        hidePrimaryAction
        secondaryActionProps={{
          type: 'primary',
          onPromise,
          w: isSmallScreen ? 'full' : undefined,
        }}
        secondaryActionTranslationId="action__done"
        sortableListProps={{
          ref,
          data: list,
          // eslint-disable-next-line
          keyExtractor: ({ id }: any) => id,
          renderItem,
          // eslint-disable-next-line
          onDragEnd: ({ data }: any) => setList(data),
          ItemSeparatorComponent: () => <Divider />,
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
