import React, { FC, useState } from 'react';

import {
  Box,
  Divider,
  IconButton,
  Image,
  SortableList,
  Switch,
  Typography,
} from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';

import { useAppSelector } from '../../../hooks/redux';

export const EditableView: FC = () => {
  const networks = useAppSelector((s) => s.network.network);
  const [list, setList] = useState<Network[]>(networks ?? []);
  const renderItem = ({ item, drag }: { item: Network; drag: () => void }) => (
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
          onPressIn={() => drag()}
        />
        <Box display="flex" flexDirection="row" alignItems="center">
          <Image
            size={{ base: 8, md: 6 }}
            source={{ uri: item.logoURI }}
            mr="3"
          />
          <Typography.Body1Strong mr="3">
            {item.shortName}
          </Typography.Body1Strong>
        </Box>
      </Box>
      <Switch labelType="false" />
    </Box>
  );
  return (
    <Box bg="surface-default" borderRadius="12" mt="3" mb="3">
      <SortableList.Container
        keyExtractor={({ id }) => id}
        data={list}
        onDragEnd={({ data }) => setList(data)}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <Divider />}
      />
    </Box>
  );
};

export default EditableView;
