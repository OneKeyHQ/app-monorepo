import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Image } from 'react-native';

import {
  QRCode,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

import {
  ONEKEY_LOGO_URL,
  SHARE_CARD_CONFIG,
  splitGroupedAddress,
} from './constants';

import type { IReceiveShareData } from './types';

interface IShareContentRendererProps {
  data: IReceiveShareData;
  onImagesReady?: () => void;
}

// memoized: rendered inside the permanently-mounted offscreen generator
export const ShareContentRenderer = memo(function ShareContentRenderer({
  data,
  onImagesReady,
}: IShareContentRendererProps) {
  const {
    title,
    subtitle,
    networkName,
    address,
    tokenLogoURI,
    networkLogoURI,
  } = data;
  const {
    width,
    minHeight,
    backgroundColor,
    content,
    title: titleStyle,
    subtitle: subtitleStyle,
    wrapper,
    cell,
    qr,
    addressCell,
    addressText,
    footer,
  } = SHARE_CARD_CONFIG;

  const addressParts = useMemo(() => splitGroupedAddress(address), [address]);

  const subtitleParts = useMemo(() => {
    const idx = networkName ? subtitle.indexOf(networkName) : -1;
    if (idx < 0 || !networkName) return null;
    return {
      before: subtitle.slice(0, idx),
      after: subtitle.slice(idx + networkName.length),
    };
  }, [subtitle, networkName]);

  const imageCount = useMemo(
    () => 1 + (tokenLogoURI ? 1 : 0) + (tokenLogoURI && networkLogoURI ? 1 : 0),
    [tokenLogoURI, networkLogoURI],
  );
  const loadedCountRef = useRef(0);
  const handleImageLoaded = useCallback(() => {
    loadedCountRef.current += 1;
    if (loadedCountRef.current >= imageCount) {
      onImagesReady?.();
    }
  }, [imageCount, onImagesReady]);

  // The white plate must only appear once the token logo actually rendered;
  // on load failure/timeout the QR stays clean and scannable (web parity).
  const [isTokenLogoLoaded, setIsTokenLogoLoaded] = useState(false);
  useEffect(() => {
    // signal readiness only after the commit that reveals the plate
    if (isTokenLogoLoaded) {
      handleImageLoaded();
    }
  }, [isTokenLogoLoaded, handleImageLoaded]);

  return (
    <YStack width={width} minHeight={minHeight} bg={backgroundColor}>
      <YStack
        px={content.paddingX}
        pt={content.paddingTop}
        flex={1}
        alignItems="center"
      >
        <SizableText
          textAlign="center"
          color={titleStyle.color}
          fontSize={titleStyle.size}
          lineHeight={titleStyle.lineHeight}
          fontWeight="600"
        >
          {title}
        </SizableText>
        <SizableText
          mt={subtitleStyle.gapAboveTitle}
          textAlign="center"
          color={subtitleStyle.color}
          fontSize={subtitleStyle.size}
          lineHeight={subtitleStyle.lineHeight}
        >
          {subtitleParts && networkName ? (
            <>
              {subtitleParts.before}
              <SizableText
                color={subtitleStyle.emphasizedColor}
                fontSize={subtitleStyle.size}
                lineHeight={subtitleStyle.lineHeight}
                fontWeight="500"
              >
                {networkName}
              </SizableText>
              {subtitleParts.after}
            </>
          ) : (
            subtitle
          )}
        </SizableText>
        <YStack
          mt={wrapper.gapAboveSubtitle}
          width="100%"
          bg={wrapper.backgroundColor}
          borderRadius={wrapper.borderRadius}
          p={wrapper.padding}
          gap={wrapper.cellGap}
        >
          <YStack
            bg={cell.backgroundColor}
            borderRadius={cell.borderRadius}
            borderWidth={1}
            borderColor={cell.borderColor}
            alignItems="center"
            justifyContent="center"
            py={qr.cellPaddingY}
          >
            <YStack>
              <QRCode value={address} size={qr.size} />
              {tokenLogoURI ? (
                // full-bleed overlay + flex centering: percentage translate
                // is unreliable on native, so avoid left/top 50% -50% here
                <YStack
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  bottom={0}
                  alignItems="center"
                  justifyContent="center"
                >
                  <YStack
                    width={qr.logoPlateSize}
                    height={qr.logoPlateSize}
                    borderRadius="$full"
                    bg="white"
                    alignItems="center"
                    justifyContent="center"
                    opacity={isTokenLogoLoaded ? 1 : 0}
                  >
                    <Image
                      source={{ uri: tokenLogoURI }}
                      style={{
                        width: qr.logoSize,
                        height: qr.logoSize,
                        borderRadius: qr.logoSize / 2,
                      }}
                      onLoad={() => setIsTokenLogoLoaded(true)}
                      onError={handleImageLoaded}
                    />
                    {networkLogoURI ? (
                      <Stack
                        position="absolute"
                        right={0}
                        bottom={0}
                        p={qr.networkBadgePadding}
                        bg="white"
                        borderRadius="$full"
                        opacity={isTokenLogoLoaded ? 1 : 0}
                      >
                        <Image
                          source={{ uri: networkLogoURI }}
                          style={{
                            width: qr.networkBadgeIconSize,
                            height: qr.networkBadgeIconSize,
                            borderRadius: qr.networkBadgeIconSize / 2,
                          }}
                          onLoad={handleImageLoaded}
                          onError={handleImageLoaded}
                        />
                      </Stack>
                    ) : null}
                  </YStack>
                </YStack>
              ) : null}
            </YStack>
          </YStack>
          <YStack
            bg={cell.backgroundColor}
            borderRadius={cell.borderRadius}
            borderWidth={1}
            borderColor={cell.borderColor}
            px={addressCell.paddingX}
            py={addressCell.paddingY}
          >
            <SizableText
              fontFamily="$monoRegular"
              color={addressText.color}
              fontSize={addressText.size}
              lineHeight={addressText.lineHeight}
            >
              <SizableText
                fontFamily="$monoRegular"
                color={addressText.highlightColor}
                fontSize={addressText.size}
                lineHeight={addressText.lineHeight}
              >
                {addressParts.leading}
              </SizableText>
              {addressParts.middle}
              <SizableText
                fontFamily="$monoRegular"
                color={addressText.highlightColor}
                fontSize={addressText.size}
                lineHeight={addressText.lineHeight}
              >
                {addressParts.trailing}
              </SizableText>
            </SizableText>
          </YStack>
        </YStack>
      </YStack>
      <XStack
        height={footer.height}
        px={footer.paddingX}
        pb={footer.paddingBottom}
        mt={wrapper.gapAboveSubtitle}
        alignItems="center"
        gap={footer.logoTextGap}
      >
        <Image
          source={{ uri: ONEKEY_LOGO_URL }}
          style={{ width: footer.logoSize, height: footer.logoSize }}
          onLoad={handleImageLoaded}
          onError={handleImageLoaded}
        />
        <SizableText
          color={footer.logoTextColor}
          fontSize={footer.logoTextSize}
          fontWeight="600"
        >
          {footer.logoText}
        </SizableText>
      </XStack>
    </YStack>
  );
});
