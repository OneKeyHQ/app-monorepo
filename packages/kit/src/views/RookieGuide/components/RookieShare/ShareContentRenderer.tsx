import { useCallback, useEffect, useRef } from 'react';

import {
  Image,
  LinearGradient,
  QRCode,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IRookieShareData } from '@onekeyhq/shared/types/rookieGuide';

import {
  BACKGROUND_GRADIENT_COLORS,
  CANVAS_CONFIG,
  DEFAULT_FOOTER_TEXT,
  DEFAULT_REFERRAL_LABEL,
  ONEKEY_LOGO_URL,
} from './constants';

interface IShareContentRendererProps {
  data: IRookieShareData;
  onImagesReady?: () => void;
}

const { size, card, badge, fonts, footer, logo, qrCode, spacing } =
  CANVAS_CONFIG;

export function ShareContentRenderer({
  data,
  onImagesReady,
}: IShareContentRendererProps) {
  const { imageUrl, title, subtitle, footerText, referralCode, referralUrl } =
    data;

  const imageLoadCountRef = useRef(0);
  // badge image + logo = 2
  const expectedImageCount = 2;

  const handleImageLoad = useCallback(() => {
    imageLoadCountRef.current += 1;
    if (onImagesReady && imageLoadCountRef.current >= expectedImageCount) {
      onImagesReady();
    }
  }, [onImagesReady]);

  useEffect(() => {
    imageLoadCountRef.current = 0;
  }, [data]);

  const referralLabel = referralCode
    ? `${DEFAULT_REFERRAL_LABEL} ${referralCode}`
    : DEFAULT_REFERRAL_LABEL;

  return (
    <YStack
      width={size}
      height={size}
      position="relative"
      collapsable={platformEnv.isNativeAndroid ? false : undefined}
    >
      {/* Background gradient */}
      <LinearGradient
        colors={BACKGROUND_GRADIENT_COLORS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        width={size}
        height={size}
        position="absolute"
        top={0}
        left={0}
      />

      {/* Content card - centered vertically above footer */}
      <YStack
        position="absolute"
        left={card.x}
        top={0}
        bottom={footer.height}
        width={card.width}
        justifyContent="center"
        alignItems="center"
      >
        <YStack
          width={card.width}
          backgroundColor="rgba(255, 255, 255, 0.9)"
          borderRadius={card.borderRadius}
          padding={card.padding}
          alignItems="center"
          shadowColor="rgba(0, 0, 0, 0.25)"
          shadowOffset={{ width: 0, height: card.shadowOffsetY }}
          shadowOpacity={1}
          shadowRadius={card.shadowBlur / 2}
          elevation={8}
        >
          {/* Badge image */}
          <Image
            source={{ uri: imageUrl }}
            width={badge.width}
            height={badge.height}
            onLoad={handleImageLoad}
            onError={handleImageLoad}
          />

          <Stack height={spacing.cardContentGap} />

          {/* Title */}
          <SizableText
            fontSize={fonts.title.size}
            fontWeight="500"
            color={fonts.title.color}
            textAlign="center"
            lineHeight={fonts.title.size * fonts.title.lineHeight}
            maxWidth={fonts.title.maxWidth}
          >
            {title}
          </SizableText>

          {/* Subtitle */}
          {subtitle ? (
            <>
              <Stack height={spacing.cardContentGap} />
              <SizableText
                fontSize={fonts.subtitle.size}
                fontWeight="500"
                color={fonts.subtitle.color}
                textAlign="center"
                lineHeight={fonts.subtitle.size * fonts.subtitle.lineHeight}
                maxWidth={fonts.subtitle.maxWidth}
              >
                {subtitle}
              </SizableText>
            </>
          ) : null}
        </YStack>
      </YStack>

      {/* Footer */}
      <Stack
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        height={footer.height}
        backgroundColor={footer.backgroundColor}
      >
        <XStack
          flex={1}
          alignItems="center"
          paddingHorizontal={footer.paddingX}
        >
          {/* Logo */}
          <Image
            source={{ uri: ONEKEY_LOGO_URL }}
            width={logo.size}
            height={logo.size}
            onLoad={handleImageLoad}
            onError={handleImageLoad}
          />

          {/* Footer text */}
          <YStack
            flex={1}
            marginLeft={spacing.footerLogoTextGap}
            justifyContent="center"
          >
            <SizableText
              fontSize={fonts.footerText.size}
              fontWeight="500"
              color={fonts.footerText.color}
              numberOfLines={1}
            >
              {footerText || DEFAULT_FOOTER_TEXT}
            </SizableText>
            <SizableText
              fontSize={fonts.referralText.size}
              fontWeight="500"
              color={fonts.referralText.color}
              numberOfLines={1}
            >
              {referralLabel}
            </SizableText>
          </YStack>

          {/* QR Code */}
          {referralUrl ? (
            <QRCode
              value={referralUrl}
              size={qrCode.size - 10}
              padding={5}
              logoBackgroundColor="white"
            />
          ) : null}
        </XStack>
      </Stack>
    </YStack>
  );
}
