import { type FC, useCallback, useMemo, useState } from 'react';

import { SearchBar, Stack } from '@onekeyhq/components';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { BaseListView, filterNetwork } from '../BaseView';

type IImmutableViewProps = {
  networks: IServerNetwork[];
  networkId?: string;
  onPressItem?: (network: IServerNetwork) => void;
};

export const ImmutableView: FC<IImmutableViewProps> = ({
  networks,
  networkId,
  onPressItem,
}) => {
  const [text, setText] = useState('');
  const onChangeText = useCallback((value: string) => {
    setText(value.trim());
  }, []);

  const data = useMemo(
    () => networks.filter(filterNetwork(text.toLowerCase())),
    [networks, text],
  );
  return (
    <Stack flex={1}>
      <Stack px="$4">
        <SearchBar
          w="100%"
          placeholder="Search"
          value={text}
          onChangeText={onChangeText}
        />
      </Stack>
      <Stack flex={1}>
        <BaseListView
          networkId={networkId}
          networks={data}
          onPressItem={onPressItem}
        />
      </Stack>
    </Stack>
  );
};
