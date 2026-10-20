import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  Illustration,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { SWAP_DESKTOP_CARD_SHADOW_WEB_STYLE } from '@onekeyhq/kit/src/views/Swap/utils/swapDesktopCardShadow';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useDustSweep } from '../DustSweepProvider';
import { getDustSweepHiddenThreshold } from '../utils/candidates';

import { DustSweepFilters } from './DustSweepFilters';
import { DUST_SWEEP_ACTION_HEIGHT } from './DustSweepSummary';
import { DustSweepTokenRow } from './DustSweepTokenRow';

// One fixed desktop height for every step (Add anyway, sweeping, result) so
// the cards never jump; longer lists scroll inside.
const DUST_SWEEP_DESKTOP_CARD_HEIGHT = 712;
// The mobile direction circle straddles the list / footer border.
export const DUST_SWEEP_MOBILE_DIRECTION_SIZE = 36;

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
  const selectableVisibleCount = visible.filter(
    (token) => !token.suspicious,
  ).length;
  const selectedVisibleCount = selected.filter(
    (token) => !token.suspicious,
  ).length;
  let selectAllValue: boolean | 'indeterminate' =
    selectedVisibleCount === selectableVisibleCount && !!selectableVisibleCount;
  if (selectedVisibleCount > 0 && selectedVisibleCount < selectableVisibleCount)
    selectAllValue = 'indeterminate';
  const loading = selecting && loadStatus === 'loading';
  const hiddenRow =
    selecting && !loading && hidden.length ? (
      <XStack
        testID="dust-sweep-hidden"
        px="$5"
        gap="$3"
        alignItems="center"
        // Desktop pins the row to the card bottom, centered on the same line as
        // the summary card's action button (which sits 20px above the edge).
        {...(desktop
          ? { height: DUST_SWEEP_ACTION_HEIGHT, mb: '$5', flexShrink: 0 }
          : // Mobile pins it above the footer, clear of the direction circle
            // half that overlaps the list.
            {
              minHeight: 60,
              py: '$2',
              mb: DUST_SWEEP_MOBILE_DIRECTION_SIZE / 2,
              flexShrink: 0,
            })}
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
    ) : null;
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
            // Same halo as the desktop Swap cards.
            '$platform-web': SWAP_DESKTOP_CARD_SHADOW_WEB_STYLE,
            height: DUST_SWEEP_DESKTOP_CARD_HEIGHT,
            maxHeight: '100%',
          }
        : {})}
    >
      {desktop ? (
        // Mirrors the "You receive" label position in the summary card.
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          height={20}
          px="$5"
          mt="$5"
        >
          {intl.formatMessage({
            id: ETranslations.wallet_approval_select_tokens,
          })}
        </SizableText>
      ) : null}
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
            // While sweeping it keeps its look but can't be changed.
            cursor={selecting ? undefined : 'not-allowed'}
          >
            <Stack pointerEvents={selecting ? 'auto' : 'none'}>
              <Checkbox
                testID="dust-sweep-select-all"
                value={selectAllValue}
                width={20}
                height={20}
                minHeight={20}
                flexShrink={0}
                borderRadius={6}
                containerProps={{ py: '$1', flexShrink: 0 }}
                disabled={selecting && (loading || !selectableVisibleCount)}
                onChange={toggleAll}
              />
            </Stack>
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
                nativeTokenSymbol={
                  selecting
                    ? current?.nativeToken.symbol
                    : session.state.snapshot?.nativeToken.symbol
                }
                selected={selected.some((item) => item.key === token.key)}
                item={selecting ? undefined : session.state.items[index]}
                paused={
                  session.state.phase === 'paused'
                    ? session.state.items.findIndex(
                        (item) => item.status === 'waiting',
                      ) === index
                    : false
                }
                onToggle={toggle}
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
          <YStack height={330} justifyContent="center" px="$10" gap="$1">
            {/* Same illustration as the wallet's empty token list. */}
            <Illustration name="QuestionMark" alignSelf="center" mb="$2" />
            <SizableText size="$bodyLgMedium" textAlign="center">
              {intl.formatMessage({ id: ETranslations.empty_noMatchingTokens })}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
              {intl.formatMessage({
                id: ETranslations.sweep_try_different_network_or_amount_range,
              })}
            </SizableText>
          </YStack>
        ) : null}
      </ScrollView>
      {hiddenRow}
    </YStack>
  );
}
