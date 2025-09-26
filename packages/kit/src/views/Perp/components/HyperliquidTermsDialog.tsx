import { useCallback, useMemo, useState } from 'react';

import type { IRenderPaginationParams } from '@onekeyhq/components';
import {
  Button,
  Checkbox,
  Dialog,
  Image,
  Portal,
  SizableText,
  Stack,
  Swiper,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { DelayedRender } from '@onekeyhq/components/src/hocs/DelayedRender';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePerpsLogo } from '../hooks/usePerpsLogo';

interface ISlideData {
  id: string;
  content: React.ReactNode;
}

function HyperliquidIntroDialogContent({
  onConfirm,
}: {
  onConfirm: () => void;
}) {
  const { gtMd } = useMedia();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAccountActivatedChecked, setIsAccountActivatedChecked] =
    useState(false);
  const [isNotResponsibleChecked, setIsNotResponsibleChecked] = useState(false);

  const bannerHeight = useMemo(() => {
    return gtMd ? 300 : 250;
  }, [gtMd]);

  const bannerWidth = useMemo(() => {
    return gtMd ? 300 : 250;
  }, [gtMd]);

  const { hyperliquidLogo } = usePerpsLogo();

  const slidesData = useMemo<ISlideData[]>(() => {
    return [
      {
        id: 'slide-1',
        content: (
          <Stack alignItems="center" justifyContent="center">
            <Stack
              height={bannerHeight}
              width={bannerWidth}
              bg="$neutral3"
              alignItems="center"
              justifyContent="center"
              borderRadius="$3"
            >
              <SizableText size="$bodyLg" color="$textSubdued">
                Sketch Placeholder 1
              </SizableText>
            </Stack>
          </Stack>
        ),
      },
      {
        id: 'slide-2',
        content: (
          <Stack alignItems="center" justifyContent="center">
            <Stack
              height={bannerHeight}
              width={bannerWidth}
              bg="$neutral3"
              alignItems="center"
              justifyContent="center"
              borderRadius="$3"
            >
              <SizableText size="$bodyLg" color="$textSubdued">
                Sketch Placeholder 2
              </SizableText>
            </Stack>
          </Stack>
        ),
      },
      {
        id: 'slide-3',
        content: (
          <Stack alignItems="center" justifyContent="center">
            <Stack
              height={bannerHeight}
              width={bannerWidth}
              bg="$neutral3"
              alignItems="center"
              justifyContent="center"
              borderRadius="$3"
            >
              <SizableText size="$bodyLg" color="$textSubdued">
                Sketch Placeholder 3
              </SizableText>
            </Stack>
          </Stack>
        ),
      },
      {
        id: 'confirmation-slide',
        content: (
          <Stack
            testID="hyperliquid-intro-confirmation-slide"
            alignItems="center"
            justifyContent="center"
          >
            <YStack gap="$6">
              <YStack alignItems="center" gap="$4">
                <Image source={hyperliquidLogo} height={70} width={200} />

                <SizableText size="$bodyLgMedium" textAlign="center">
                  Trade perpetual futures securely through our trusted partner.
                </SizableText>
              </YStack>

              <YStack gap="$2">
                <XStack alignItems="flex-start" gap="$3">
                  <Checkbox
                    value={isAccountActivatedChecked}
                    onChange={(value) => setIsAccountActivatedChecked(!!value)}
                    label="I understand that once my account is activated, everything
                      I deposit and trade in the perpetuals account will be
                      managed by Hyperliquid ↗"
                    labelProps={{
                      variant: '$bodySm',
                    }}
                  />
                </XStack>

                <XStack alignItems="flex-start" gap="$3">
                  <Checkbox
                    value={isNotResponsibleChecked}
                    onChange={(value) => setIsNotResponsibleChecked(!!value)}
                    label="OneKey is not responsible for any losses from your trades
                      or Hyperliquid. We only provide market data and order
                      tools."
                    labelProps={{
                      variant: '$bodySm',
                    }}
                  />
                </XStack>
              </YStack>

              <XStack justifyContent="center" pt="$2">
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  textAlign="center"
                >
                  By clicking Agree, you accept our{' '}
                  <SizableText size="$bodySm" color="$textInteractive">
                    Terms of Service
                  </SizableText>{' '}
                  and{' '}
                  <SizableText size="$bodySm" color="$textInteractive">
                    Privacy Policy
                  </SizableText>
                  .
                </SizableText>
              </XStack>
            </YStack>
          </Stack>
        ),
      },
    ];
  }, [
    bannerHeight,
    bannerWidth,
    hyperliquidLogo,
    isAccountActivatedChecked,
    isNotResponsibleChecked,
  ]);

  const keyExtractor = useCallback((item: ISlideData) => item.id, []);

  const renderItem = useCallback(({ item }: { item: ISlideData }) => {
    return (
      <Stack alignItems="center" justifyContent="center">
        {item.content}
      </Stack>
    );
  }, []);

  const showPaginationButton = !platformEnv.isNative;

  const portalContainerName = useMemo(() => {
    return `hyperliquid-intro-swiper-controls--${stringUtils.generateUUID()}`;
  }, []);

  const isConfirmationSlide = currentIndex === slidesData.length - 1;
  const canConfirm = isAccountActivatedChecked && isNotResponsibleChecked;

  const renderPagination = useCallback(
    ({
      currentIndex: paginationCurrentIndex,
      goToNextIndex,
      gotToPrevIndex,
    }: IRenderPaginationParams) => (
      <Portal.Body container={portalContainerName as any}>
        {slidesData.length > 1 ? (
          <XStack
            testID="hyperliquid-intro-pagination"
            gap="$1"
            position="absolute"
            right={0}
            left={0}
            bottom={30}
            jc="center"
            zIndex={1}
          >
            {slidesData.map((_, index) => (
              <Stack
                key={index}
                w="$3"
                $gtMd={{
                  w: '$4',
                }}
                h="$1"
                borderRadius="$full"
                bg="$neutral6"
                opacity={paginationCurrentIndex === index ? 1 : 0.3}
              />
            ))}
          </XStack>
        ) : null}

        {showPaginationButton ? (
          <>
            <XStack gap="$3" pt="$4" justifyContent="flex-end">
              <Button
                variant="tertiary"
                size="small"
                onPress={gotToPrevIndex}
                disabled={currentIndex === 0}
              >
                Previous
              </Button>
              <Button
                variant={isConfirmationSlide ? 'primary' : 'tertiary'}
                size="small"
                onPress={() => {
                  if (isConfirmationSlide) {
                    if (canConfirm) {
                      onConfirm();
                    }
                    return;
                  }
                  goToNextIndex();
                }}
                disabled={isConfirmationSlide ? !canConfirm : null}
              >
                {isConfirmationSlide ? 'Confirm' : 'Next'}
              </Button>
            </XStack>
          </>
        ) : null}
      </Portal.Body>
    ),
    [
      canConfirm,
      currentIndex,
      isConfirmationSlide,
      onConfirm,
      portalContainerName,
      showPaginationButton,
      slidesData,
    ],
  );

  return (
    <Stack>
      <Stack minHeight={200}>
        <DelayedRender delay={300}>
          <Swiper
            height="100%"
            position="relative"
            index={currentIndex}
            initialNumToRender={4}
            onChangeIndex={({ index: newIndex }) => setCurrentIndex(newIndex)}
            keyExtractor={keyExtractor}
            data={slidesData}
            renderItem={renderItem}
            renderPagination={renderPagination}
            overflow="hidden"
            borderRadius="$3"
          />
        </DelayedRender>
      </Stack>

      <Portal.Container name={portalContainerName} />
    </Stack>
  );
}

export async function showHyperliquidTermsDialog() {
  const isTermsAccepted =
    await backgroundApiProxy.simpleDb.perp.getHyperliquidTermsAccepted();
  if (isTermsAccepted) {
    return;
  }

  const dialog = Dialog.show({
    // title: 'Hyperliquid Introduction',
    renderContent: (
      <HyperliquidIntroDialogContent
        onConfirm={async () => {
          await dialog.close();
          await backgroundApiProxy.simpleDb.perp.setHyperliquidTermsAccepted(
            true,
          );
        }}
      />
    ),
    showExitButton: false,
    disableDrag: true,
    dismissOnOverlayPress: false,
    showFooter: false,
    showCancelButton: false,
    showConfirmButton: false,
  });

  return dialog;
}
