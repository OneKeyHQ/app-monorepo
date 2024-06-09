import { type FC, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { SearchBar, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { networkFuseSearch } from '../../utils';
import { BaseListView } from '../BaseView';

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
  const intl = useIntl();
  const onChangeText = useCallback((value: string) => {
    setText(value.trim());
  }, []);

  const data = useMemo(() => {
    if (!text) {
      return networks;
    }
    return networkFuseSearch(networks, text);
  }, [networks, text]);
  return (
    <Stack flex={1}>
      <Stack px="$5" pb="$4">
        <SearchBar
          placeholder={intl.formatMessage({ id: ETranslations.global_search })}
          value={text}
          onChangeText={onChangeText}
        />
      </Stack>
      <BaseListView
        networkId={networkId}
        networks={data}
        onPressItem={onPressItem}
      />
    </Stack>
  );
};
