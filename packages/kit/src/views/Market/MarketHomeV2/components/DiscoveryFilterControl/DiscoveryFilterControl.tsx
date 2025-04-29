import { useCallback, useState } from 'react';

import { Icon, Select, SizableText, XStack } from '@onekeyhq/components';
import type {
  ISelectProps,
  ISelectRenderTriggerProps,
} from '@onekeyhq/components/src/forms/Select/type';

export type IEFilterOption = 'trending' | 'top_searches' | 'newest';

export interface IDiscoveryFilterControlProps {
  value?: IEFilterOption;
  onChange?: (value: IEFilterOption) => void;
  testID?: string;
}

const OPTIONS = [
  {
    label: 'Trending',
    value: 'trending',
    leading: <Icon name="FireSolid" color="$iconSubdued" size="$5" />,
  },
  {
    label: 'Top searches',
    value: 'top_searches',
    leading: (
      <Icon name="ChartTrendingUpSolid" color="$iconSubdued" size="$5" />
    ),
  },
  {
    label: 'Newest',
    value: 'newest',
    leading: (
      <Icon name="ClockTimeHistorySolid" color="$iconSubdued" size="$5" />
    ),
  },
];

export function DiscoveryFilterControl({
  value = 'trending',
  onChange,
  testID = 'discovery-filter-control',
}: IDiscoveryFilterControlProps) {
  const [selectedValue, setSelectedValue] = useState<IEFilterOption>(value);

  const handleChange = useCallback(
    (val: string) => {
      const newValue = val as IEFilterOption;
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
