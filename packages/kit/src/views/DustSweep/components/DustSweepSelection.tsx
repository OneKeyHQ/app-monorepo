import {
  Button,
  Checkbox,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { DustSweepSummaryCard } from './DustSweepSummaryCard';
import { DustSweepTokenRow } from './DustSweepTokenRow';

import type { IDustSweepCandidate, IDustSweepSession } from '../stateMachine';
import type { useIntl } from 'react-intl';

export function DustSweepSelection({
  state,
  summary,
  targetToken,
  desktop,
  slippage,
  amountRange,
  intl,
  onToggleAll,
  onToggle,
  onAddHidden,
  onChangeAmountRange,
  onChangeSlippage,
  onStart,
}: {
  state: IDustSweepSession;
  summary: {
    selectedCount: number;
    allSelected: boolean;
    indeterminate: boolean;
  };
  targetToken?: IDustSweepCandidate;
  desktop: boolean;
  slippage: number;
  amountRange: number;
  intl: ReturnType<typeof useIntl>;
  onToggleAll: () => void;
  onToggle: (key: string) => void;
  onAddHidden: () => void;
  onChangeAmountRange: (value: number) => void;
  onChangeSlippage: () => void;
  onStart: () => void;
}) {
  const hiddenCount = state.items.filter(
    (item) => item.token.hidden && !state.selectedKeys.includes(item.key),
  ).length;
  const selectedFiatValue = state.items
    .filter((item) => state.selectedKeys.includes(item.key))
    .reduce((sum, item) => sum + Number(item.token.fiatValue || 0), 0)
    .toFixed(2);
  const listCard = (
    <YStack
      flex={desktop ? 1 : undefined}
      gap="$3"
      p={desktop ? '$5' : '$0'}
      borderRadius={desktop ? '$5' : '$0'}
      borderWidth={desktop ? 1 : 0}
      borderColor="$borderSubdued"
    >
      <XStack gap="$2">
        {[1, 10, 100].map((value) => (
          <Button
            key={value}
            testID={`dust-sweep-range-${value}`}
            size="small"
            variant={amountRange === value ? 'secondary' : 'tertiary'}
            onPress={() => onChangeAmountRange(value)}
          >
            &lt;${value}
          </Button>
        ))}
      </XStack>
      <XStack alignItems="center" gap="$3">
        <Checkbox
          testID="dust-sweep-select-all"
          value={summary.indeterminate ? 'indeterminate' : summary.allSelected}
          onChange={onToggleAll}
          accessibilityLabel={intl.formatMessage({
            id: ETranslations.global_select_all,
          })}
        />
        <SizableText>
          {intl.formatMessage({ id: ETranslations.global_select_all })}
        </SizableText>
      </XStack>
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <YStack>
          {state.items.map((item) => (
            <DustSweepTokenRow
              key={item.key}
              item={item}
              selected={state.selectedKeys.includes(item.key)}
              onToggle={() => onToggle(item.key)}
            />
          ))}
        </YStack>
      </ScrollView>
      {hiddenCount > 0 ? (
        <YStack gap="$1">
          <XStack justifyContent="space-between" alignItems="center" gap="$3">
            <SizableText flex={1} color="$textSubdued">
              {intl.formatMessage(
                { id: ETranslations.sweep_hidden_tokens_below_amount },
                { count: hiddenCount, amount: '$0.01' },
              )}
            </SizableText>
            <Button
              testID="dust-sweep-add-hidden"
              size="small"
              variant="tertiary"
              onPress={onAddHidden}
            >
              {intl.formatMessage({ id: ETranslations.sweep_add_anyway })}
            </Button>
          </XStack>
          <SizableText color="$textSubdued" size="$bodySm">
            {intl.formatMessage({
              id: ETranslations.sweep_gas_fees_exceed_value,
            })}
          </SizableText>
        </YStack>
      ) : null}
    </YStack>
  );
  const summaryCard = (
    <DustSweepSummaryCard
      targetToken={targetToken}
      selectedCount={summary.selectedCount}
      selectedFiatValue={selectedFiatValue}
      slippage={slippage}
      onChangeSlippage={onChangeSlippage}
      onStart={onStart}
      disabled={!summary.selectedCount || !targetToken}
      desktop={desktop}
    />
  );
  return (
    <YStack flex={1} gap="$4" px="$5" py="$4">
      <XStack justifyContent="space-between" alignItems="center">
        <YStack gap="$1">
          <NetworkSelectorTriggerHome num={0} size="large" />
          <SizableText color="$textSubdued">
            {summary.selectedCount}
          </SizableText>
        </YStack>
      </XStack>
      <XStack flex={1} gap="$5" flexDirection={desktop ? 'row' : 'column'}>
        {listCard}
        {desktop ? summaryCard : null}
      </XStack>
      {desktop ? null : summaryCard}
    </YStack>
  );
}
