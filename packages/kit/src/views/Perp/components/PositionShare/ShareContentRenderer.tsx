import { useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Image,
  QRCode,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getHyperliquidTokenImageUris } from '@onekeyhq/shared/src/utils/perpsUtils';

import {
  BACKGROUNDS,
  CANVAS_CONFIG,
  SHOW_REFERRAL_CODE,
  getPnlDisplayInfo,
  getSharePriceLabelIds,
} from './constants';

import type { IShareConfig, IShareData } from './types';

interface IShareContentRendererProps {
  data: IShareData;
  config: IShareConfig;
  scale?: number;
  // Reports whether every currently-expected source (background, token icon,
  // referral QR) has been drawn. Fires again with `false` when a new source
  // joins the expectation late — the referral QR only mounts after an
  // invite-code round-trip — so callers must read the latest value.
  onImagesReadyStateChange?: (isReady: boolean) => void;
  referralQrCodeUrl?: string;
  referralDisplayText?: string;
  isReferralReady?: boolean;
}

const { size, padding, colors, fonts, layout, display } = CANVAS_CONFIG;

export function ShareContentRenderer({
  data,
  config,
  scale = 1,
  onImagesReadyStateChange,
  referralQrCodeUrl,
  referralDisplayText,
  isReferralReady = true,
}: IShareContentRendererProps) {
  const intl = useIntl();
  const {
    side,
    mode,
    token,
    tokenDisplayName,
    tokenImageUrl,
    pnl,
    leverage,
    entryPrice,
    markPrice,
    priceType = 'mark',
  } = data;
  const pnlBn = new BigNumber(pnl || '0');
  const isProfit = pnlBn.isGreaterThan(0);
  const pnlColor = isProfit ? colors.long : colors.short;
  const sideColor = side === 'long' ? colors.long : colors.short;
  // `token` keeps the dex prefix the display name drops. Spot is the exception:
  // its raw fill coin (`@149`, `PURR/USDC`) has no valid image path.
  const tokenImage =
    tokenImageUrl ||
    getHyperliquidTokenImageUris(
      mode !== 'spot' && token ? token : tokenDisplayName,
    )[0];
  const pnlDisplayMode = config.pnlDisplayMode;

  const selectedBackground = isProfit
    ? BACKGROUNDS.profit[0]
    : BACKGROUNDS.loss[0];

  const scaledSize = size * scale;
  const scaledPadding = padding * scale;
  const scaledFonts = useMemo(
    () => ({
      coin: fonts.coin * scale,
      side: fonts.side * scale,
      pnl: fonts.pnl * scale,
      priceLabel: fonts.priceLabel * scale,
      priceValue: fonts.priceValue * scale,
    }),
    [scale],
  );
  const scaledLayout = useMemo(
    () => ({
      tokenSize: layout.tokenSize * scale,
      stickerSize: layout.stickerSize * scale,
    }),
    [scale],
  );
  const tokenY = layout.tokenY * scale;
  const pnlDisplayText = getPnlDisplayInfo(data, pnlDisplayMode);
  const pnlFontSize =
    pnlDisplayText.length > 6
      ? scaledFonts.pnl * (1 - (pnlDisplayText.length - 6) * 0.06)
      : scaledFonts.pnl;
  const { entryPriceLabelId, markPriceLabelId } = getSharePriceLabelIds({
    mode,
    priceType,
  });

  // Readiness is judged as a set of named sources rather than a resettable
  // counter: every signal (image onLoad, QR onRenderReady) fires only once,
  // so zeroing a counter when the expectation changes would strand the gate
  // below its target forever. Sources stay ready once ready; the expected
  // set is derived from props and can grow late.
  const readySourcesRef = useRef<Set<string>>(new Set());
  const showsReferralQrCode = Boolean(
    SHOW_REFERRAL_CODE && isReferralReady && referralQrCodeUrl,
  );
  // Image sources carry their URI in the key: when the background swaps
  // (profit <-> loss) or the token icon changes, the expected key changes
  // with it, so the stale image's ready mark no longer satisfies the gate —
  // readiness retracts by derivation, with no effect that could misfire.
  const expectedSources = useMemo(() => {
    const expected: string[] = [];
    if (selectedBackground) expected.push(`background:${selectedBackground}`);
    if (display.showTokenIcon) expected.push(`tokenIcon:${tokenImage}`);
    // the QR code signals once its lazily-loaded encoder has drawn the
    // symbol, so a ViewShot capture can't run against an empty code
    if (showsReferralQrCode) expected.push('qrCode');
    return expected;
  }, [selectedBackground, tokenImage, showsReferralQrCode]);

  const evaluateReadiness = useCallback(() => {
    onImagesReadyStateChange?.(
      expectedSources.every((source) => readySourcesRef.current.has(source)),
    );
  }, [expectedSources, onImagesReadyStateChange]);

  const handleSourceReady = useCallback(
    (source: string) => {
      readySourcesRef.current.add(source);
      evaluateReadiness();
    },
    [evaluateReadiness],
  );
  const handleBackgroundReady = useCallback(
    () => handleSourceReady(`background:${selectedBackground}`),
    [handleSourceReady, selectedBackground],
  );
  const handleTokenIconReady = useCallback(
    () => handleSourceReady(`tokenIcon:${tokenImage}`),
    [handleSourceReady, tokenImage],
  );
  const handleQrCodeReady = useCallback(
    () => handleSourceReady('qrCode'),
    [handleSourceReady],
  );

  // re-evaluate whenever the expected set itself changes: it may have grown
  // past the already-ready sources (report false until the newcomer lands)
  // or shrunk to a subset of them (report true immediately)
  useEffect(() => {
    evaluateReadiness();
  }, [evaluateReadiness]);

  return (
    <YStack
      width={scaledSize}
      height={scaledSize}
      position="relative"
      collapsable={platformEnv.isNativeAndroid ? false : undefined}
    >
      {selectedBackground ? (
        <Image
          source={{ uri: selectedBackground }}
          width={scaledSize}
          height={scaledSize}
          position="absolute"
          top={0}
          left={0}
          onLoad={handleBackgroundReady}
          onError={handleBackgroundReady}
        />
      ) : null}

      <YStack
        width={scaledSize}
        height={scaledSize}
        padding={scaledPadding}
        position="relative"
      >
        <YStack
          position="absolute"
          top={tokenY - scaledLayout.tokenSize / 2}
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
                  onLoad={handleTokenIconReady}
                  onError={handleTokenIconReady}
                />
              </Stack>
            ) : null}

            {display.showCoinName ? (
              <SizableText
                fontSize={scaledFonts.coin}
                lineHeight={scaledFonts.coin * layout.lineHeight}
                fontWeight="600"
                color={colors.textPrimary}
              >
                {tokenDisplayName}
              </SizableText>
            ) : null}

            {display.showSideAndLeverage ? (
              <XStack
                py={layout.badgePaddingY * scale}
                px={layout.badgePaddingX * scale}
                borderRadius="$3"
                bg={
                  side === 'long'
                    ? colors.sideLongBackground
                    : colors.sideShortBackground
                }
              >
                <SizableText
                  fontSize={scaledFonts.side}
                  lineHeight={scaledFonts.side * layout.lineHeight}
                  fontWeight="600"
                  color={sideColor}
                >
                  {(() => {
                    const isSpot = mode === 'spot';
                    const isLong = side === 'long';
                    let labelId: ETranslations;
                    if (isSpot) {
                      labelId = isLong
                        ? ETranslations.global_buy
                        : ETranslations.global_sell;
                    } else {
                      labelId = isLong
                        ? ETranslations.perp_long
                        : ETranslations.perp_short;
                    }
                    const label = intl.formatMessage({ id: labelId });
                    return isSpot ? label : `${label} ${leverage}X`;
                  })()}
                </SizableText>
              </XStack>
            ) : null}
          </XStack>
        </YStack>

        {display.showPnl ? (
          <Stack
            position="absolute"
            top={layout.pnlY * scale - (pnlFontSize * layout.lineHeight) / 2}
            left={scaledPadding}
          >
            <SizableText
              fontSize={pnlFontSize}
              lineHeight={pnlFontSize * layout.lineHeight}
              fontWeight="600"
              color={pnlColor}
            >
              {pnlDisplayText}
            </SizableText>
          </Stack>
        ) : null}

        {display.showEntryPrice ? (
          <YStack
            position="absolute"
            top={
              layout.entryPriceY * scale -
              (scaledFonts.priceLabel * layout.lineHeight) / 2
            }
            left={scaledPadding}
            gap={layout.priceGap * scale}
          >
            <SizableText
              fontSize={scaledFonts.priceLabel}
              fontWeight="600"
              color={colors.textSecondary}
              opacity={layout.labelOpacity}
              lineHeight={scaledFonts.priceLabel * layout.lineHeight}
            >
              {intl.formatMessage({
                id: entryPriceLabelId,
              })}
            </SizableText>
            <SizableText
              fontSize={scaledFonts.priceValue}
              fontWeight="600"
              color={colors.textPrimary}
              lineHeight={scaledFonts.priceValue * layout.lineHeight}
            >
              {entryPrice}
            </SizableText>
          </YStack>
        ) : null}

        {display.showMarkPrice ? (
          <YStack
            position="absolute"
            top={
              layout.markPriceY * scale -
              (scaledFonts.priceLabel * layout.lineHeight) / 2
            }
            left={scaledPadding}
            gap={layout.priceGap * scale}
          >
            <SizableText
              fontSize={scaledFonts.priceLabel}
              fontWeight="600"
              color={colors.textSecondary}
              opacity={layout.labelOpacity}
              lineHeight={scaledFonts.priceLabel * layout.lineHeight}
            >
              {intl.formatMessage({
                id: markPriceLabelId,
              })}
            </SizableText>
            <SizableText
              fontSize={scaledFonts.priceValue}
              fontWeight="600"
              color={colors.textPrimary}
              lineHeight={scaledFonts.priceValue * layout.lineHeight}
            >
              {markPrice}
            </SizableText>
          </YStack>
        ) : null}

        {SHOW_REFERRAL_CODE && isReferralReady ? (
          <Stack
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            height={layout.referralHeight * scale}
            backgroundColor={colors.referralBackground}
            justifyContent="center"
            paddingLeft={scaledPadding}
            paddingRight={scaledPadding}
          >
            <XStack
              alignItems="center"
              justifyContent="space-between"
              width="100%"
            >
              <YStack gap={layout.priceGap * scale}>
                <SizableText
                  fontSize={scaledFonts.priceLabel}
                  fontWeight="600"
                  color={colors.textTertiary}
                  opacity={layout.labelOpacity}
                  lineHeight={scaledFonts.priceLabel * layout.lineHeight}
                >
                  {intl.formatMessage({
                    id: ETranslations.perp_share_referral_desc,
                  })}
                </SizableText>
                <SizableText
                  fontSize={scaledFonts.priceValue}
                  fontWeight="600"
                  color={colors.textTertiary}
                  lineHeight={scaledFonts.priceValue * layout.lineHeight}
                >
                  {referralDisplayText}
                </SizableText>
              </YStack>
              <QRCode
                value={referralQrCodeUrl ?? ''}
                size={layout.qrCodeSize * scale - 5}
                padding={8}
                logoBackgroundColor="white"
                onRenderReady={handleQrCodeReady}
              />
            </XStack>
          </Stack>
        ) : null}
      </YStack>
    </YStack>
  );
}
