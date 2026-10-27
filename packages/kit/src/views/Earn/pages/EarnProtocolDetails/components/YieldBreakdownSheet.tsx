import { useEffect, useMemo, useState } from 'react';

import type { ColorTokens } from '@onekeyhq/components';
import {
  Divider,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { EarnIcon } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnIcon';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import type { IEarnPopupActionIcon } from '@onekeyhq/shared/types/staking';

import {
  buildYieldSegments,
  formatCountdown,
} from '../mobile/yieldSegments.utils';

const COUNTDOWN_TICK_MS = 1000;

function CampaignCountdown({ endTime }: { endTime: number }) {
  const [remaining, setRemaining] = useState(() => endTime - Date.now());

  useEffect(() => {
    setRemaining(endTime - Date.now());
    const timer = setInterval(() => {
      setRemaining(endTime - Date.now());
    }, COUNTDOWN_TICK_MS);
    return () => clearInterval(timer);
  }, [endTime]);

  const parts = formatCountdown(remaining);
  if (!parts) {
    return null;
  }

  // Unit letters are part of the numeric readout in the design, so they stay
  // inline with the digits instead of becoming translated words.
  const segments: [number, string][] = [
    [parts.days, 'D'],
    [parts.hours, 'H'],
    [parts.minutes, 'M'],
    [parts.seconds, 'S'],
  ];

  return (
    <XStack gap="$1" ai="baseline">
      {segments.map(([value, unit]) => (
        <XStack key={unit} gap="$0.5" ai="baseline">
          <SizableText size="$bodyMdMedium">{value}</SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {unit}
          </SizableText>
        </XStack>
      ))}
    </XStack>
  );
}

function YieldBar({ items }: { items: IEarnPopupActionIcon['data']['items'] }) {
  const segments = useMemo(() => buildYieldSegments(items), [items]);
  if (!segments.length) {
    return null;
  }
  return (
    <XStack
      h="$1.5"
      bg="$bgStrongActive"
      borderRadius="$full"
      overflow="hidden"
    >
      {segments.map((segment, index) => (
        <Stack
          key={index}
          flex={segment.weight}
          bg={segment.color as ColorTokens}
        />
      ))}
    </XStack>
  );
}

export function YieldBreakdownSheet({
  data,
}: {
  data: IEarnPopupActionIcon['data'];
}) {
  const summary = data.yieldSummary;
  const items = data.items ?? [];
  const yieldItems = items.filter((item) => item.kind !== 'fee');
  const feeItem = items.find((item) => item.kind === 'fee');

  return (
    <YStack p="$5" gap="$4">
      {summary ? (
        <XStack jc="space-between" ai="flex-start" gap="$4">
          <YStack gap="$0.5">
            <EarnText
              text={summary.totalApy.title}
              size="$bodySm"
              color="$textSubdued"
            />
            <EarnText text={summary.totalApy.description} size="$headingLg" />
          </YStack>
          {summary.campaignEnd ? (
            <YStack gap="$0.5" ai="flex-end">
              <EarnText
                text={summary.campaignEnd.title}
                size="$bodySm"
                color="$textSubdued"
              />
              <CampaignCountdown endTime={summary.campaignEnd.endTime} />
            </YStack>
          ) : null}
        </XStack>
      ) : null}

      <YieldBar items={items} />

      <YStack gap="$3">
        {yieldItems.map((item, index) => (
          <XStack key={index} jc="space-between" ai="center" gap="$3">
            <XStack ai="center" gap="$2" flex={1} minWidth={0}>
              <Stack
                w="$2"
                h="$2"
                borderRadius="$full"
                bg={(item.color || '$bgSubdued') as ColorTokens}
              />
              <EarnText
                text={item.yieldTitle ?? item.title}
                size="$bodyMd"
                numberOfLines={1}
              />
            </XStack>
            <XStack ai="center" gap="$1.5" flexShrink={0}>
              {item.yieldToken ? (
                <Token size="xs" tokenImageUri={item.yieldToken.info.logoURI} />
              ) : null}
              {item.yieldToken ? (
                <SizableText size="$bodyMd" color="$textSubdued">
                  {item.yieldToken.info.symbol}
                </SizableText>
              ) : null}
              <SizableText size="$bodyMdMedium">{item.value}</SizableText>
            </XStack>
          </XStack>
        ))}
      </YStack>

      {data.description?.length ? (
        <YStack gap="$2">
          {data.description.map((text, index) => (
            <EarnText
              key={index}
              text={text}
              size="$bodySm"
              color={text.color || '$textSubdued'}
            />
          ))}
        </YStack>
      ) : null}

      {feeItem ? (
        <>
          <Divider />
          <YStack gap="$2">
            <XStack jc="space-between" ai="center" gap="$3">
              <XStack ai="center" gap="$2" flex={1} minWidth={0}>
                {feeItem.icon ? (
                  <EarnIcon
                    icon={feeItem.icon}
                    size="$5"
                    color="$iconSubdued"
                  />
                ) : null}
                <EarnText
                  text={feeItem.title}
                  size="$bodyMd"
                  numberOfLines={1}
                />
              </XStack>
              <SizableText size="$bodyMdMedium">{feeItem.value}</SizableText>
            </XStack>
            {data.bulletList?.length ? (
              <YStack gap="$2">
                {data.bulletList.map((text, index) => (
                  // Mirrors the fee row above: an icon-width column then the
                  // same gap. The dot centers under the icon and the copy lands
                  // on the label's own offset by construction, so neither
                  // alignment drifts if the icon size or gap ever changes.
                  <XStack key={index} gap="$2" ai="flex-start">
                    <Stack w="$5" ai="center" flexShrink={0}>
                      <Stack
                        h="$1"
                        w="$1"
                        my="$1.5"
                        borderRadius="$full"
                        bg="$iconSubdued"
                      />
                    </Stack>
                    <SizableText
                      size={text.size || '$bodySm'}
                      color={text.color || '$textSubdued'}
                      flex={1}
                      flexWrap="wrap"
                    >
                      {text.text}
                    </SizableText>
                  </XStack>
                ))}
              </YStack>
            ) : null}
          </YStack>
        </>
      ) : null}
    </YStack>
  );
}
