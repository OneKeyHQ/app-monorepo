import {
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getHyperliquidTokenImageUrl } from '@onekeyhq/shared/src/utils/perpsUtils';

import {
  BACKGROUNDS,
  CANVAS_CONFIG,
  REFERRAL_CODE,
  SHOW_REFERRAL_CODE,
  STICKERS,
} from './constants';

import type { IShareConfig, IShareData } from './types';

interface IShareContentRendererProps {
  data: IShareData;
  config: IShareConfig;
  scale?: number;
}

const { size, padding, colors, fonts, layout, display } = CANVAS_CONFIG;

export function ShareContentRenderer({
  data,
  config,
  scale = 1,
}: IShareContentRendererProps) {
  const {
    side,
    token,
    tokenImageUrl,
    pnl,
    pnlPercent,
    leverage,
    entryPrice,
    markPrice,
  } = data;
  const pnlNum = parseFloat(pnl);
  const pnlPercentNum = parseFloat(pnlPercent);
  const pnlColor = pnlNum >= 0 ? colors.long : colors.short;
  const pnlSign = pnlPercentNum >= 0 ? '+' : '';
  const sideColor = side === 'long' ? colors.long : colors.short;
  const tokenImage = tokenImageUrl || getHyperliquidTokenImageUrl(token);
  const selectedSticker =
    config.stickerIndex !== null ? STICKERS[config.stickerIndex] : null;

  const isProfit = pnlNum >= 0;
  const availableBackgrounds = isProfit ? BACKGROUNDS.profit : BACKGROUNDS.loss;
  const allBackgrounds = [...BACKGROUNDS.neutral, ...availableBackgrounds];
  const selectedBackground = allBackgrounds[config.backgroundIndex] ?? null;

  const scaledSize = size * scale;
  const scaledPadding = padding * scale;
  const scaledFonts = {
    coin: fonts.coin * scale,
    side: fonts.side * scale,
    pnl: fonts.pnl * scale,
    priceLabel: fonts.priceLabel * scale,
    priceValue: fonts.priceValue * scale,
    referral: fonts.referral * scale,
    customText: fonts.customText * scale,
  };
  const scaledLayout = {
    logoSize: layout.logoSize * scale,
    tokenSize: layout.tokenSize * scale,
    tokenY: layout.tokenY * scale,
    stickerSize: layout.stickerSize * scale,
    customTextMaxWidth: layout.customTextMaxWidth * scale,
    pnlY: layout.pnlY * scale,
  };
  const tokenY = layout.tokenY * scale;

  return (
    <YStack
      width={scaledSize}
      height={scaledSize}
      position="relative"
      collapsable={platformEnv.isNativeAndroid ? false : undefined}
    >
      {selectedBackground ? (
        <Image
          source={selectedBackground}
          width={scaledSize}
          height={scaledSize}
          position="absolute"
          top={0}
          left={0}
        />
      ) : null}

      <YStack
        width={scaledSize}
        height={scaledSize}
        padding={scaledPadding}
        position="relative"
      >
        <YStack
          position="absolute" // 改为绝对定位
          top={tokenY - scaledLayout.tokenSize / 2} // Y 坐标
          left={scaledPadding}
        >
          <XStack alignItems="center" gap="$2">
            {display.showTokenIcon ? (
              <Stack
                width={scaledLayout.tokenSize}
                height={scaledLayout.tokenSize}
                borderRadius="$full"
                overflow="hidden"
                backgroundColor="$bgSubdued"
              >
                <Image
                  source={{ uri: tokenImage }}
                  width={scaledLayout.tokenSize}
                  height={scaledLayout.tokenSize}
                />
              </Stack>
            ) : null}

            {display.showCoinName ? (
              <SizableText
                fontSize={scaledFonts.coin}
                lineHeight={scaledFonts.coin * 1.2}
                fontWeight="600"
                color={colors.textPrimary}
              >
                {token}
              </SizableText>
            ) : null}

            {display.showSideAndLeverage ? (
              <XStack
                py={18 * scale} // 应用 scale
                px={20 * scale}
                borderRadius="$3"
                bg={
                  side === 'long'
                    ? colors.sideLongBackground
                    : colors.sideShortBackground
                }
              >
                <SizableText
                  fontSize={scaledFonts.side}
                  lineHeight={scaledFonts.side * 1.2}
                  fontWeight="600"
                  color={sideColor}
                >
                  {`${side.toUpperCase()} ${leverage}X`}
                </SizableText>
              </XStack>
            ) : null}
          </XStack>
        </YStack>

        {display.showPnl ? (
          <Stack
            position="absolute"
            top={layout.pnlY * scale - (scaledFonts.pnl * 1.2) / 2}
            left={scaledPadding}
          >
            <SizableText
              fontSize={scaledFonts.pnl}
              lineHeight={scaledFonts.pnl * 1.2}
              fontWeight="600"
              color={pnlColor}
            >
              {`${pnlSign}${pnlPercent}%`}
            </SizableText>
          </Stack>
        ) : null}

        {display.showEntryPrice ? (
          <YStack
            position="absolute"
            top={
              layout.entryPriceY * scale - (scaledFonts.priceLabel * 1.2) / 2
            }
            left={scaledPadding}
            gap={1.5}
          >
            <SizableText
              fontSize={scaledFonts.priceLabel}
              fontWeight="600"
              color={colors.textSecondary}
              opacity={0.5}
              lineHeight={scaledFonts.priceLabel * 1.2}
            >
              Entry Price
            </SizableText>
            <SizableText
              fontSize={scaledFonts.priceValue}
              fontWeight="600"
              color={colors.textPrimary}
              lineHeight={scaledFonts.priceValue * 1.2}
            >
              {entryPrice}
            </SizableText>
          </YStack>
        ) : null}

        {display.showMarkPrice ? (
          <YStack
            position="absolute"
            top={layout.markPriceY * scale - (scaledFonts.priceLabel * 1.2) / 2}
            left={scaledPadding}
            gap={1.5}
          >
            <SizableText
              fontSize={scaledFonts.priceLabel}
              fontWeight="600"
              color={colors.textSecondary}
              opacity={0.5}
              lineHeight={scaledFonts.priceLabel * 1.2}
            >
              Mark Price
            </SizableText>
            <SizableText
              fontSize={scaledFonts.priceValue}
              fontWeight="600"
              color={colors.textPrimary}
              lineHeight={scaledFonts.priceValue * 1.2}
            >
              {markPrice}
            </SizableText>
          </YStack>
        ) : null}

        {selectedSticker ? (
          <SizableText
            position="absolute"
            right={scaledPadding}
            bottom={scaledPadding}
            fontSize={scaledLayout.stickerSize}
            lineHeight={scaledLayout.stickerSize * 1.2}
          >
            {selectedSticker}
          </SizableText>
        ) : null}
        {SHOW_REFERRAL_CODE ? (
          <Stack
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            height={216 * scale}
            backgroundColor={colors.referralBackground}
            justifyContent="center"
            paddingLeft={scaledPadding}
          >
            <YStack gap={1.5}>
              <SizableText
                fontSize={scaledFonts.priceLabel}
                fontWeight="600"
                color={colors.textTertiary}
                opacity={0.5}
                lineHeight={scaledFonts.priceLabel * 1.2}
              >
                Referral Code
              </SizableText>
              <SizableText
                fontSize={scaledFonts.priceValue}
                fontWeight="600"
                color={colors.textTertiary}
                lineHeight={scaledFonts.priceValue * 1.2}
              >
                {REFERRAL_CODE}
              </SizableText>
            </YStack>
          </Stack>
        ) : null}
      </YStack>
    </YStack>
  );
}
