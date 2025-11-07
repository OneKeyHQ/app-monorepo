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
  };

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
        gap="$0"
      >
        <YStack marginTop={scaledLayout.tokenY - scaledLayout.tokenSize / 2}>
          <XStack alignItems="center" gap="$3">
            {display.showTokenIcon ? (
              <Image
                source={{ uri: tokenImage }}
                width={scaledLayout.tokenSize}
                height={scaledLayout.tokenSize}
              />
            ) : null}

            <YStack gap="$1">
              {display.showCoinName ? (
                <SizableText
                  fontSize={scaledFonts.coin}
                  lineHeight={scaledFonts.coin * 1.2}
                  fontWeight="bold"
                  color={colors.textPrimary}
                >
                  {token}
                </SizableText>
              ) : null}

              {display.showSideAndLeverage ? (
                <SizableText
                  fontSize={scaledFonts.side}
                  lineHeight={scaledFonts.side * 1.2}
                  fontWeight="600"
                  color={sideColor}
                >
                  {`${side.toUpperCase()} ${leverage}X`}
                </SizableText>
              ) : null}
            </YStack>
          </XStack>
        </YStack>

        <YStack flex={1} justifyContent="center" gap="$4">
          {display.showPnl ? (
            <SizableText
              fontSize={scaledFonts.pnl}
              lineHeight={scaledFonts.pnl * 1.2}
              fontWeight="bold"
              color={pnlColor}
            >
              {`${pnlSign}${pnlPercent}%`}
            </SizableText>
          ) : null}

          <YStack gap="$2">
            {display.showEntryPrice ? (
              <XStack gap="$2">
                <SizableText
                  fontSize={scaledFonts.priceLabel}
                  color={colors.textSecondary}
                >
                  Entry Price
                </SizableText>
                <SizableText
                  fontSize={scaledFonts.priceValue}
                  fontWeight="600"
                  color={colors.textPrimary}
                >
                  {entryPrice}
                </SizableText>
              </XStack>
            ) : null}

            {display.showMarkPrice ? (
              <XStack gap="$2">
                <SizableText
                  fontSize={scaledFonts.priceLabel}
                  color={colors.textSecondary}
                >
                  Mark Price
                </SizableText>
                <SizableText
                  fontSize={scaledFonts.priceValue}
                  fontWeight="600"
                  color={colors.textPrimary}
                >
                  {markPrice}
                </SizableText>
              </XStack>
            ) : null}
          </YStack>
        </YStack>

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
            bottom={scaledPadding}
            left={scaledPadding}
          >
            <SizableText
              fontSize={scaledFonts.referral}
              color={colors.textTertiary}
            >
              {REFERRAL_CODE}
            </SizableText>
          </Stack>
        ) : null}
      </YStack>
    </YStack>
  );
}
