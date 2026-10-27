import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Image } from 'react-native';

import { SizableText, XStack, YStack } from '@onekeyhq/components';

import { ReceiveQRCode } from '../ReceiveQRCode';
import { ReceiveTitleBlocks } from '../ReceiveTitle';

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

const HIDDEN_TITLE_PROPS = { position: 'absolute', opacity: 0 } as const;

// memoized: rendered inside the permanently-mounted offscreen generator
export const ShareContentRenderer = memo(
  ({ data, onImagesReady }: IShareContentRendererProps) => {
    const { title, titleLogo, subtitle, networkName, address } = data;
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

    // the QR code with its mark (the lazily-loaded encoder has to draw it
    // before a ViewShot capture), the footer logo, and the title logo when
    // there is one
    const imageCount = 2 + (titleLogo ? 1 : 0);
    const loadedCountRef = useRef(0);
    const handleImageLoaded = useCallback(() => {
      loadedCountRef.current += 1;
      if (loadedCountRef.current >= imageCount) {
        onImagesReady?.();
      }
    }, [imageCount, onImagesReady]);

    // The title shows its logo only once the logo has loaded. Until then,
    // and if it never does, the card carries the plain title: a capture that
    // gives up waiting must not show an empty slot beside the symbol.
    const [isTitleLogoLoaded, setIsTitleLogoLoaded] = useState(false);
    const handleTitleLogoLoaded = useCallback(
      () => setIsTitleLogoLoaded(true),
      [],
    );
    useEffect(() => {
      // signal readiness only after the commit that reveals the logo
      if (isTitleLogoLoaded) {
        handleImageLoaded();
      }
    }, [isTitleLogoLoaded, handleImageLoaded]);

    const titleTextProps = {
      color: titleStyle.color,
      fontSize: titleStyle.size,
      lineHeight: titleStyle.lineHeight,
      fontWeight: '600',
    } as const;

    return (
      <YStack width={width} minHeight={minHeight} bg={backgroundColor}>
        <YStack
          px={content.paddingX}
          pt={content.paddingTop}
          flex={1}
          alignItems="center"
        >
          {isTitleLogoLoaded ? null : (
            <SizableText textAlign="center" {...titleTextProps}>
              {title}
            </SizableText>
          )}
          {titleLogo ? (
            <ReceiveTitleBlocks
              // Laid out from the start but kept out of sight until its logo
              // has loaded, so the one image that loads is the one captured.
              {...(isTitleLogoLoaded ? undefined : HIDDEN_TITLE_PROPS)}
              logo={titleLogo}
              textProps={titleTextProps}
              blockGap={titleStyle.blockGap}
              iconGap={titleStyle.iconGap}
              icon={
                <Image
                  source={{ uri: titleLogo.uri }}
                  style={{
                    width: titleStyle.iconSize,
                    height: titleStyle.iconSize,
                    borderRadius: titleStyle.iconSize / 2,
                  }}
                  // Android fades images in for 300ms after onLoad;
                  // ViewShot must never capture mid-fade (OK-58189)
                  fadeDuration={0}
                  onLoad={handleTitleLogoLoaded}
                  onError={handleImageLoaded}
                />
              }
            />
          ) : null}
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
              <ReceiveQRCode
                value={address}
                size={qr.size}
                onRenderReady={handleImageLoaded}
              />
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
            fadeDuration={0}
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
  },
);

ShareContentRenderer.displayName = 'ShareContentRenderer';
