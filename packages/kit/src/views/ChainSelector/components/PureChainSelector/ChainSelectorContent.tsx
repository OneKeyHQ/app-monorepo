import { type FC, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { SearchBar, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { useFuseSearch } from '../../hooks/useFuseSearch';

import { ChainSelectorListView } from './ChainSelectorListView';

type IPureChainSelectorContentProps = {
  networks: IServerNetwork[];
  networkId?: string;
  onPressItem?: (network: IServerNetwork) => void;
};

export const PureChainSelectorContent: FC<IPureChainSelectorContentProps> = ({
  networks,
  networkId,
  onPressItem,
}) => {
  const [text, setText] = useState('');
  const intl = useIntl();
  const onChangeText = useCallback((value: string) => {
    setText(value.trim());
  }, []);

  const networkFuseSearch = useFuseSearch(networks);

  const data = useMemo(() => {
    if (!text) {
      return networks;
    }
    return networkFuseSearch(text);
  }, [networkFuseSearch, text, networks]);
  return (
    <Stack flex={1}>
      <Stack px="$5" pb="$4">
        <SearchBar
          placeholder={intl.formatMessage({ id: ETranslations.global_search })}
          value={text}
          onChangeText={onChangeText}
          testID="chain-selector"
        />
      </Stack>
      <ChainSelectorListView
        networkId={networkId}
        networks={data}
        onPressItem={onPressItem}
      />
    </Stack>
  );
};
