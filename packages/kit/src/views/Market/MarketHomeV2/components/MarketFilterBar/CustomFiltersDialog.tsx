import { useCallback, useState } from 'react';

import {
  Button,
  ButtonGroup,
  Input,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

interface ICustomFiltersDialogProps {
  onClose: () => void;
  onApply: (filters: IFilterOptions) => void;
}

interface IFilterSectionProps {
  label: string;
  minValue: number | undefined;
  maxValue: number | undefined;
  onMinChange: (value: number | undefined) => void;
  onMaxChange: (value: number | undefined) => void;
}

function FilterSection({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
}: IFilterSectionProps) {
  return (
    <YStack space="$3">
      <Stack>{label}</Stack>
      <XStack space="$4">
        <Input
          flex={1}
          placeholder="Min"
          value={minValue?.toString() || ''}
          onChangeText={(text) => {
            const num = text ? Number(text) : undefined;
            onMinChange(num);
          }}
          keyboardType="numeric"
        />
        <Input
          flex={1}
          placeholder="Max"
          value={maxValue?.toString() || ''}
          onChangeText={(text) => {
            const num = text ? Number(text) : undefined;
            onMaxChange(num);
          }}
          keyboardType="numeric"
        />
      </XStack>
    </YStack>
  );
}

export interface IFilterOptions {
  period: string;
  liquidity: {
    min?: number;
    max?: number;
  };
  turnover: {
    min?: number;
    max?: number;
  };
  marketCap: {
    min?: number;
    max?: number;
  };
}

const PERIODS = ['5m', '1h', '4h', '24h'];

export default function CustomFiltersDialog({
  onClose,
  onApply,
}: ICustomFiltersDialogProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(PERIODS[0]);
  const [filters, setFilters] = useState<IFilterOptions>({
    period: PERIODS[0],
    liquidity: { min: 5000, max: undefined },
    turnover: { min: 10_000, max: undefined },
    marketCap: { min: undefined, max: undefined },
  });

  const handlePeriodSelect = useCallback((period: string) => {
    setSelectedPeriod(period);
    setFilters((prev) => ({ ...prev, period }));
  }, []);

  const handleInputChange = useCallback(
    (field: 'liquidity' | 'turnover' | 'marketCap', type: 'min' | 'max') =>
      (value: number | undefined) => {
        setFilters((prev) => ({
          ...prev,
          [field]: {
            ...prev[field],
            [type]: value,
          },
        }));
      },
    [],
  );

  const handleReset = useCallback(() => {
    setSelectedPeriod(PERIODS[0]);
    setFilters({
      period: PERIODS[0],
      liquidity: { min: 5000, max: undefined },
      turnover: { min: 10_000, max: undefined },
      marketCap: { min: undefined, max: undefined },
    });
  }, []);

  const handleApply = useCallback(() => {
    onApply(filters);
    onClose();
  }, [filters, onApply, onClose]);

  return (
    <YStack px="$5" py="$6" space="$8">
      <YStack space="$6">
        <YStack space="$3">
          <Stack>Period</Stack>
          <XStack>
            <ButtonGroup>
              {PERIODS.map((period) => (
                <ButtonGroup.Item
                  key={period}
                  onPress={() => handlePeriodSelect(period)}
                  bg={selectedPeriod === period ? '$bgPrimary' : '$bgStrong'}
                >
                  {period}
                </ButtonGroup.Item>
              ))}
            </ButtonGroup>
          </XStack>
        </YStack>

        <FilterSection
          label="Liquidity ($)"
          minValue={filters.liquidity.min}
          maxValue={filters.liquidity.max}
          onMinChange={handleInputChange('liquidity', 'min')}
          onMaxChange={handleInputChange('liquidity', 'max')}
        />

        <FilterSection
          label="Turnover ($)"
          minValue={filters.turnover.min}
          maxValue={filters.turnover.max}
          onMinChange={handleInputChange('turnover', 'min')}
          onMaxChange={handleInputChange('turnover', 'max')}
        />

        <FilterSection
          label="Market cap ($)"
          minValue={filters.marketCap.min}
          maxValue={filters.marketCap.max}
          onMinChange={handleInputChange('marketCap', 'min')}
          onMaxChange={handleInputChange('marketCap', 'max')}
        />
      </YStack>

      <XStack space="$4" justifyContent="flex-end">
        <Button variant="tertiary" onPress={handleReset}>
          Default
        </Button>
        <Button variant="primary" onPress={handleApply}>
          Filter
        </Button>
      </XStack>
    </YStack>
  );
}
