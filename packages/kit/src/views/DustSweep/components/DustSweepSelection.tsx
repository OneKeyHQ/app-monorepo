import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  Empty,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useDustSweep } from '../DustSweepProvider';
import { getDustSweepHiddenThreshold } from '../utils/candidates';

import { DustSweepFilters } from './DustSweepFilters';
import { DustSweepTokenRow } from './DustSweepTokenRow';

export function DustSweepSelection({ desktop }: { desktop: boolean }) {
  const {
    current,
    visible,
    hidden,
    selected,
    selecting,
    session,
    loadStatus,
    partialError,
    toggle,
    toggleAll,
    addHidden,
    retry,
  } = useDustSweep();
  const intl = useIntl();
  const rows = selecting
    ? visible
    : session.state.items.map((item) => item.token);
  let selectAllValue: boolean | 'indeterminate' =
    selected.length === visible.length && !!visible.length;
  if (selected.length > 0 && selected.length < visible.length)
    selectAllValue = 'indeterminate';
  const loading = selecting && loadStatus === 'loading';
  return (
    <YStack
      testID="dust-sweep-list"
      flex={1}
      minHeight={0}
      overflow="hidden"
      {...(desktop
        ? {
            borderWidth: 1,
            borderColor: '$borderSubdued',
            borderRadius: '$5',
            height: selecting ? 592 : 540,
            maxHeight: '100%',
          }
        : {})}
    >
      <ScrollView
        flex={1}
        contentContainerStyle={{
          paddingTop: desktop ? 8 : 0,
          paddingBottom: 16,
        }}
      >
        <DustSweepFilters desktop={desktop} />
        {loading || rows.length ? (
          <XStack
            height={40}
            px="$5"
            gap="$3"
            alignItems="center"
            opacity={selecting ? 1 : 0.4}
          >
            <Checkbox
              testID="dust-sweep-select-all"
              value={selectAllValue}
              disabled={!selecting || loading}
              onChange={toggleAll}
            />
            <SizableText size="$bodyLgMedium">
              {intl.formatMessage({ id: ETranslations.label_select_all })}
            </SizableText>
          </XStack>
        ) : null}
        {loading
          ? Array.from({ length: 7 }, (_, index) => (
              <DustSweepTokenRow key={index} />
            ))
          : rows.map((token, index) => (
              <DustSweepTokenRow
                key={token.key}
                token={token}
                selected={selected.some((item) => item.key === token.key)}
                item={selecting ? undefined : session.state.items[index]}
                paused={
                  session.state.phase === 'paused' &&
                  session.state.items.findIndex(
                    (item) => item.status === 'waiting',
                  ) === index
                }
                onToggle={() => toggle(token.key)}
              />
            ))}
        {selecting && !loading && (loadStatus === 'error' || partialError) ? (
          <YStack p="$5" gap="$4">
            <SizableText>
              {intl.formatMessage({ id: ETranslations.global_network_error })}
            </SizableText>
            <Button testID="dust-sweep-retry" onPress={retry}>
              {intl.formatMessage({ id: ETranslations.global_retry })}
            </Button>
          </YStack>
        ) : null}
        {!loading && loadStatus === 'ready' && !partialError && !rows.length ? (
          <YStack height={330} justifyContent="center" px="$5">
            <Empty
              title={intl.formatMessage(
                { id: ETranslations.sweep_no_small_balances_on_network },
                { network: current?.network.name ?? '' },
              )}
              description={intl.formatMessage({
                id: ETranslations.sweep_try_different_network_or_amount_range,
              })}
            />
          </YStack>
        ) : null}
        {selecting && !loading && hidden.length ? (
          <XStack
            testID="dust-sweep-hidden"
            minHeight={60}
            px="$5"
            py="$2"
            gap="$3"
            alignItems="center"
          >
            <YStack flex={1}>
              <SizableText size="$bodyLg">
                {intl.formatMessage(
                  { id: ETranslations.sweep_hidden_tokens_below_amount },
                  {
                    count: hidden.length,
                    amount: `$${getDustSweepHiddenThreshold(current?.network.networkId ?? '')}`,
                  },
                )}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.sweep_gas_fees_exceed_value,
                })}
              </SizableText>
            </YStack>
            <Button
              testID="dust-sweep-add-hidden"
              size="small"
              height={30}
              borderRadius="$full"
              onPress={addHidden}
            >
              {intl.formatMessage({ id: ETranslations.sweep_add_anyway })}
            </Button>
          </XStack>
        ) : null}
      </ScrollView>
    </YStack>
  );
}
