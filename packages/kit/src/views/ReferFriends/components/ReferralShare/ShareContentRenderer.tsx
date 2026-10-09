import { memo, useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';
import { Image } from 'react-native';

import { QRCode, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ONEKEY_LOGO_URL } from '@onekeyhq/kit/src/views/Receive/components/ReceiveShare/constants';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { renderCopy } from '../../pages/InviteReward/copyTemplate';

import { REFERRAL_SHARE_CARD } from './constants';
import { REFERRAL_SHARE_COPY } from './referralShareCopy';

import type { IReferralShareData } from './types';

// The logo image and the QR code (its encoder loads lazily) must both have
// drawn before a capture.
const ASSETS_TO_LOAD = 2;

// Dark card: brand, the invitee's headline, the code, then a footer with
// the link and its QR code. Memoized: it renders offscreen for capture.
export const ShareContentRenderer = memo(
  ({
    data,
    onImagesReady,
  }: {
    data: IReferralShareData;
    onImagesReady?: () => void;
  }) => {
    const intl = useIntl();
    const { copy, inviteCode, inviteUrl, displayUrl } = data;
    const card = REFERRAL_SHARE_CARD;

    const loadedCountRef = useRef(0);
    const handleAssetReady = useCallback(() => {
      loadedCountRef.current += 1;
      if (loadedCountRef.current >= ASSETS_TO_LOAD) {
        onImagesReady?.();
      }
    }, [onImagesReady]);

    return (
      <YStack width={card.width} bg={card.backgroundColor}>
        <YStack px={card.paddingX} pt={card.paddingX}>
          <XStack ai="center" gap={card.brand.gap}>
            <Image
              source={{ uri: ONEKEY_LOGO_URL }}
              style={{
                width: card.brand.logoSize,
                height: card.brand.logoSize,
                borderRadius: card.brand.logoSize / 4,
              }}
              // Android fades images in after onLoad; a capture must never
              // land mid-fade.
              fadeDuration={0}
              onLoad={handleAssetReady}
              onError={handleAssetReady}
            />
            <SizableText
              color={card.textColor}
              fontSize={card.brand.textSize}
              fontWeight="600"
            >
              {REFERRAL_SHARE_COPY.brand}
            </SizableText>
          </XStack>
          <SizableText
            mt={card.headline.gapAbove}
            color={card.textColor}
            fontSize={card.headline.size}
            lineHeight={card.headline.lineHeight}
            fontWeight="600"
          >
            {renderCopy(copy.headline, {
              rate: (
                <SizableText
                  color={card.accentColor}
                  fontSize={card.headline.size}
                  lineHeight={card.headline.lineHeight}
                  fontWeight="600"
                >
                  {copy.rate}
                </SizableText>
              ),
            })}
          </SizableText>
          <YStack mt={card.code.gapAbove}>
            <SizableText
              color={card.subduedTextColor}
              fontSize={card.code.labelSize}
              lineHeight={card.code.labelLineHeight}
            >
              {intl.formatMessage({ id: ETranslations.referral_your_code })}
            </SizableText>
            <SizableText
              color={card.textColor}
              fontSize={card.code.size}
              lineHeight={card.code.lineHeight}
              fontWeight="600"
              numberOfLines={1}
            >
              {inviteCode}
            </SizableText>
          </YStack>
        </YStack>
        <XStack
          mt={card.footer.gapAbove}
          px={card.paddingX}
          py={card.footer.paddingY}
          bg={card.footerBackgroundColor}
          ai="center"
          gap="$4"
        >
          <YStack flex={1} minWidth={0} gap="$1">
            <SizableText
              color={card.textColor}
              fontSize={card.footer.titleSize}
              lineHeight={card.footer.titleLineHeight}
              fontWeight="600"
            >
              {REFERRAL_SHARE_COPY.scanToJoin}
            </SizableText>
            <SizableText
              color={card.subduedTextColor}
              fontSize={card.footer.urlSize}
              lineHeight={card.footer.urlLineHeight}
              numberOfLines={1}
            >
              {displayUrl}
            </SizableText>
          </YStack>
          {/* The QR code draws its own light plate, so it reads on the dark
              footer as is. */}
          <QRCode
            value={inviteUrl}
            size={card.footer.qrSize}
            onRenderReady={handleAssetReady}
          />
        </XStack>
      </YStack>
    );
  },
);

ShareContentRenderer.displayName = 'ShareContentRenderer';
