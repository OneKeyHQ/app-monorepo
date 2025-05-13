import { useCallback, useState } from 'react';

import { Icon, Select, SizableText, XStack } from '@onekeyhq/components';
import type {
  ISelectProps,
  ISelectRenderTriggerProps,
} from '@onekeyhq/components/src/forms/Select/type';

export enum EFilterOption {
  Trending = 'trending',
  TopSearches = 'top_searches',
  Newest = 'newest',
}

export interface IDiscoveryFilterControlProps {
  value?: EFilterOption;
  onChange?: (value: EFilterOption) => void;
  testID?: string;
}

const OPTIONS = [
  {
    label: 'Trending',
    value: EFilterOption.Trending,
    leading: <Icon name="FireSolid" color="$iconSubdued" size="$5" />,
  },
  {
    label: 'Top searches',
    value: EFilterOption.TopSearches,
    leading: (
      <Icon name="ChartTrendingUpSolid" color="$iconSubdued" size="$5" />
    ),
  },
  {
    label: 'Newest',
    value: EFilterOption.Newest,
    leading: (
      <Icon name="ClockTimeHistorySolid" color="$iconSubdued" size="$5" />
    ),
  },
];

export function DiscoveryFilterControl({
  value = EFilterOption.Trending,
  onChange,
  testID = 'discovery-filter-control',
}: IDiscoveryFilterControlProps) {
  const [selectedValue, setSelectedValue] = useState<EFilterOption>(value);

  const handleChange = useCallback(
    (val: string) => {
      const newValue = val as EFilterOption;
      setSelectedValue(newValue);
      onChange?.(newValue);
    },
    [onChange],
  );

  const renderTrigger = useCallback(
    (props: ISelectRenderTriggerProps) => {
      const { disabled } = props;
      const selectedOption = OPTIONS.find(
        (option) => option.value === selectedValue,
      );

      return (
        <XStack
          py="$1.5"
          px="$3"
          borderRadius="$3"
          bg="$neutral5"
          alignItems="center"
          gap="$2"
          opacity={disabled ? 0.5 : 1}
        >
          {selectedOption?.leading}
          <SizableText size="$bodyMdMedium" color="$text">
            {selectedOption?.label}
          </SizableText>
          <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$4" />
        </XStack>
      );
    },
    [selectedValue],
  );

  return (
    <Select
      title="Filter Options"
      items={OPTIONS}
      value={selectedValue}
      onChange={handleChange as unknown as ISelectProps<string>['onChange']}
      renderTrigger={renderTrigger}
      testID={testID}
      floatingPanelProps={{
        width: '$56',
      }}
    />
  );
}
