import React, { FC, useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  IconButton,
  Image,
  Modal,
  SortableList,
  Switch,
  Typography,
  useUserDevice,
} from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useManageNetworks } from '../../../hooks';

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
  const { size } = useUserDevice();
  const { serviceNetwork } = backgroundApiProxy;
  const { allNetworks } = useManageNetworks();
  const [list, setList] = useState<Network[]>(allNetworks ?? []);

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
        network={item}
        initialValue={networksIdMap[item.id]}
        onDrag={drag}
        onChange={onChange}
      />
    ),
    [onChange, networksIdMap],
  );

  const onPromise = useCallback(async () => {
    await serviceNetwork.updateNetworks(
      list.map((item) => [item.id, networksIdMap[item.id]]),
    );
    onPress?.();
  }, [serviceNetwork, list, onPress, networksIdMap]);

  const onClose = useCallback(() => false, []);

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__customize_network' })}
      height="560px"
      hidePrimaryAction
      onClose={onClose}
      secondaryActionProps={{
        type: 'primary',
        onPromise,
        w: size === 'SMALL' ? 'full' : undefined,
      }}
      secondaryActionTranslationId="action__done"
      scrollViewProps={{
        children: (
          <Box bg="surface-default" borderRadius="12">
            <SortableList.Container
              keyExtractor={({ id }) => id}
              data={list}
              onDragEnd={({ data }) => setList(data)}
              renderItem={renderItem}
              ItemSeparatorComponent={() => <Divider />}
            />
          </Box>
        ),
      }}
    />
  );
};

export default SortableView;
