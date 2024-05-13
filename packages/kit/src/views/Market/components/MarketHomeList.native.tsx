import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Icon,
  ListView,
  Select,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export function MarketHomeList() {
  const selectOptions = useMemo(
    () => [
      { label: 'Default', value: 'Default' },
      { label: 'Last price', value: 'Last price' },
      { label: 'Most 24h volume', value: 'Most 24h volume' },
      { label: 'Most market cap', value: 'Most market cap' },
      { label: 'Price change up', value: 'Price change up' },
      { label: 'Price change down', value: 'Price change down' },
    ],
    [],
  );

  const renderSelectTrigger = useCallback(
    ({ label }: { label?: string }) => (
      <XStack ai="center" space="$1">
        <SizableText>{label}</SizableText>
        <Icon name="ChevronBottomSolid" size="$4" />
      </XStack>
    ),
    [],
  );

  useEffect(() => {
    void backgroundApiProxy.serviceMarket.fetchConfig().then(console.log);
  }, []);

  const [sortByType, setSortByType] = useState('Default');
  return (
    <YStack px="$5" borderBottomWidth="px" borderBottomColor="$borderSubbed">
      <XStack h="$11" ai="center" justifyContent="space-between">
        <XStack ai="center" space="$2">
          <Icon name="FilterSortOutline" color="$iconSubdued" size="$5" />
          <Select
            items={selectOptions}
            title="Sort by"
            value={sortByType}
            onChange={setSortByType}
            renderTrigger={renderSelectTrigger}
          />
        </XStack>
        <Icon name="SliderVerOutline" color="$iconSubdued" size="$5" />
      </XStack>
      {/* <ListView /> */}
    </YStack>
  );
}
