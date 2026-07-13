import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { LightweightChart } from '@onekeyhq/kit/src/components/LightweightChart';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { Layout } from './utils/Layout';

const LINE_COLOR = '#8F91E8';
const PANEL_BG = '#171421';
const PANEL_BG_SUBDUED = '#211E2D';
const TEXT_SUBDUED = '#A19DAF';
const IS_NATIVE = platformEnv.isNative;

const START_TIME = 1_718_419_200;
const ETH_PRICE_DATA: IMarketTokenChart = [
  1673.3, 1672.7, 1672.7, 1674.1, 1673.8, 1675.5, 1676, 1674.2, 1673.3, 1674.1,
  1674.8, 1675.8, 1674.7, 1675.8, 1674.8, 1677.5, 1676.9, 1676.5, 1678, 1677.4,
  1676.5, 1676.9, 1677.5, 1675.9, 1673.6, 1674, 1675, 1677.5, 1675.7, 1676,
  1674, 1674, 1673.7, 1674, 1673.6, 1674.2, 1674.2, 1673.7, 1673.7, 1675.7,
  1672.7, 1671.8, 1673.1, 1673.5, 1673.7, 1674.7, 1677.7, 1677.6, 1677.6,
  1677.4,
].map((value, index) => [START_TIME + index * 60, value]);

function formatAxisPrice(price: number) {
  const roundedPrice = Math.round(price);
  if (roundedPrice % 2 !== 0) {
    return '';
  }
  return roundedPrice.toLocaleString('en-US');
}

function PeriodTab({ active, label }: { active?: boolean; label: string }) {
  const minWidth = active ? 72 : 64;
  const nativeMinWidth = active ? 58 : 50;

  return (
    <Stack
      minWidth={IS_NATIVE ? nativeMinWidth : minWidth}
      height={42}
      alignItems="center"
      justifyContent="center"
      borderRadius="$4"
      bg={active ? '#2A2738' : 'transparent'}
    >
      <SizableText
        size="$bodyMdMedium"
        color={active ? '#F4F1FF' : TEXT_SUBDUED}
      >
        {label}
      </SizableText>
    </Stack>
  );
}

function LightweightChartReferenceCard() {
  return (
    <YStack
      testID="lightweight-chart-style-demo"
      width="100%"
      maxWidth={430}
      bg={PANEL_BG}
      borderRadius="$6"
      overflow="hidden"
      px="$5"
      py="$5"
      gap="$5"
    >
      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        <XStack alignItems="center" gap="$3" flex={1} minWidth={0}>
          <Stack
            width={38}
            height={38}
            borderRadius="$full"
            bg="#35339A"
            alignItems="center"
            justifyContent="center"
          >
            <SizableText size="$headingMd" color="#FFFFFF">
              ETH
            </SizableText>
          </Stack>
          <YStack gap="$1" flex={1} minWidth={0}>
            <SizableText size="$headingXl" color="#FFFFFF">
              ETH
            </SizableText>
            <Stack
              alignSelf="flex-start"
              px="$2"
              py="$0.5"
              borderRadius="$3"
              bg="#2A2738"
            >
              <SizableText size="$bodySm" color={TEXT_SUBDUED}>
                100 倍杠杆
              </SizableText>
            </Stack>
          </YStack>
        </XStack>
        <YStack alignItems="flex-end" gap="$1" flexShrink={0}>
          <SizableText
            size={IS_NATIVE ? '$headingXl' : '$heading2xl'}
            color="#FFFFFF"
            numberOfLines={1}
          >
            $1,677.70
          </SizableText>
          <SizableText
            size={IS_NATIVE ? '$bodyMdMedium' : '$bodyLgMedium'}
            color="#35F091"
            numberOfLines={1}
          >
            +$4.70 · ↗0.28%
          </SizableText>
        </YStack>
      </XStack>

      <Stack ml="$-5" mr="$-2">
        <LightweightChart
          data={ETH_PRICE_DATA}
          height={350}
          lineColor={LINE_COLOR}
          topColor="rgba(143, 145, 232, 0)"
          bottomColor="rgba(143, 145, 232, 0)"
          textSubduedColor={TEXT_SUBDUED}
          lineWidth={4}
          seriesType="dotted-area"
          showPriceScale
          showTimeScale={false}
          priceScaleMargins={{ top: 0.14, bottom: 0.08 }}
          priceFormatter={formatAxisPrice}
          priceFormatterTickStep={2}
          fontSize={16}
        />
      </Stack>

      <XStack alignItems="center" justifyContent="space-between">
        <PeriodTab active label="1小时" />
        <PeriodTab label="4小时" />
        <PeriodTab label="12小时" />
        <PeriodTab label="24小时" />
        <PeriodTab label="1周" />
        <Stack
          width={IS_NATIVE ? 38 : 42}
          height={42}
          alignItems="center"
          justifyContent="center"
          borderRadius="$3"
          borderWidth="$px"
          borderColor="#4A465A"
        >
          <SizableText size="$headingLg" color="#FFFFFF">
            ||
          </SizableText>
        </Stack>
      </XStack>

      <YStack borderRadius="$4" overflow="hidden">
        <XStack
          height={56}
          alignItems="center"
          justifyContent="space-between"
          px="$4"
          bg={PANEL_BG_SUBDUED}
        >
          <SizableText size="$bodyLg" color={TEXT_SUBDUED}>
            未平仓量
          </SizableText>
          <SizableText size="$bodyLg" color={TEXT_SUBDUED}>
            $3543.7万
          </SizableText>
        </XStack>
        <Stack height="$0.5" bg={PANEL_BG} />
        <XStack
          height={56}
          alignItems="center"
          justifyContent="space-between"
          px="$4"
          bg={PANEL_BG_SUBDUED}
        >
          <SizableText size="$bodyLg" color={TEXT_SUBDUED}>
            资金费率
          </SizableText>
          <SizableText size="$bodyLgMedium" color={TEXT_SUBDUED}>
            -&lt;0.01%
          </SizableText>
        </XStack>
      </YStack>
    </YStack>
  );
}

const LightweightChartStyleGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="LightweightChartStyle"
    elements={[
      {
        title: 'Perps chart visual reference',
        element: (
          <YStack alignItems="center" bg="#0B0911" py="$6">
            <LightweightChartReferenceCard />
          </YStack>
        ),
      },
    ]}
  />
);

export default LightweightChartStyleGallery;
