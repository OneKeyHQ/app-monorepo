import { useCallback, useMemo, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import type { ICarouselInstance, IYStackProps } from '@onekeyhq/components';
import {
  AnimatePresence,
  Button,
  Carousel,
  Checkbox,
  Dialog,
  Divider,
  IconButton,
  Image,
  Progress,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { DelayedRender } from '@onekeyhq/components/src/hocs/DelayedRender';
import { PERPS_TERMS_OVERLAY_Z_INDEX } from '@onekeyhq/shared/src/consts/zIndexConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import {
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePerpsLogo } from '../hooks/usePerpsLogo';

import type { LayoutChangeEvent, LayoutRectangle } from 'react-native';

interface ISlideData {
  id: string;
  content: React.ReactNode;
}

const useHeightRatio = () => {
  const { height } = useWindowDimensions();
  return height / 800;
};

export function HyperliquidTermsContent({
  overlayHeight,
  onConfirm,
  renderDelay = 0,
  onPageIndexChange,
}: {
  overlayHeight: number;
  onConfirm: () => void;
  renderDelay?: number;
  onPageIndexChange?: (index: number) => void;
}) {
  const [layout, setLayout] = useState<LayoutRectangle>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setLayout(e.nativeEvent.layout);
  }, []);

  const intl = useIntl();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAccountActivatedChecked, setIsAccountActivatedChecked] =
    useState(false);
  const [isNotResponsibleChecked, setIsNotResponsibleChecked] = useState(false);
  const carouselRef = useRef<ICarouselInstance>(null);

  const { hyperliquidLogo } = usePerpsLogo();

  const HEIGHT_RATIO = useHeightRatio();

  const { gtMd } = useMedia();

  const slidesData = useMemo<ISlideData[]>(() => {
    const slideImageMaxHeight = gtMd ? 400 : 300;
    const slideImageHeight = gtMd ? 400 : 300;
    const bannerWidth = gtMd ? Math.max(slideImageHeight, 340) : 300;
    const slide3StackHeight = 300 * HEIGHT_RATIO;
    const confirmationSlideStyle: IYStackProps | undefined =
      platformEnv.isNative
        ? undefined
        : {
            zIndex: 10,
            minHeight: overlayHeight,
            height: overlayHeight,
          };
    return [
      {
        id: 'slide-1',
        content: (
          <Stack alignItems="center" justifyContent="center" px="$6">
            <Image
              source={require('@onekeyhq/kit/assets/perps/HL_intro_1.png')}
              size={slideImageHeight}
              maxHeight={slideImageMaxHeight}
              maxWidth={slideImageMaxHeight}
            />
            <YStack
              gap="$2"
              justifyContent="flex-start"
              mt="-$6"
              w={bannerWidth}
              px={gtMd ? undefined : '$4'}
            >
              <SizableText size="$heading2xl">
                Professional Experience
              </SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                Master the charts with K-lines and real-time trading data at
                your fingertips.
              </SizableText>
            </YStack>
          </Stack>
        ),
      },
      {
        id: 'slide-2',
        content: (
          <Stack alignItems="center" justifyContent="center" px="$6">
            <Stack>
              <Image
                source={require('@onekeyhq/kit/assets/perps/HL_intro_2.png')}
                size={slideImageHeight}
                maxHeight={slideImageMaxHeight}
                maxWidth={slideImageMaxHeight}
              />
            </Stack>
            <YStack
              gap="$2"
              justifyContent="flex-start"
              mt="-$6"
              w={bannerWidth}
            >
              <SizableText size="$heading2xl">
                Professional Experience
              </SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                Master the charts with K-lines and real-time trading data at
                your fingertips.
              </SizableText>
            </YStack>
          </Stack>
        ),
      },
      {
        id: 'slide-3',
        content: (
          <Stack alignItems="center" justifyContent="center" px="$6">
            <Stack>
              <Image
                source={require('@onekeyhq/kit/assets/perps/HL_intro_3.png')}
                size={slideImageHeight}
                maxHeight={slideImageMaxHeight}
                maxWidth={slideImageMaxHeight}
              />
            </Stack>
            <YStack
              gap="$2"
              mt="-$6"
              justifyContent="flex-start"
              w={bannerWidth}
            >
              <SizableText size="$heading2xl">
                Professional Experience
              </SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                Master the charts with K-lines and real-time trading data at
                your fingertips.
              </SizableText>
            </YStack>
          </Stack>
        ),
      },
      {
        id: 'confirmation-slide',
        content: (
          <YStack {...confirmationSlideStyle}>
            <ScrollView
              maxHeight={platformEnv.isNative ? undefined : overlayHeight}
              contentContainerStyle={{
                paddingBottom: 32,
              }}
            >
              <Stack
                testID="hyperliquid-intro-confirmation-slide"
                alignItems="center"
                justifyContent="center"
                px="$6"
              >
                <YStack gap={gtMd ? '$3' : '$2'}>
                  <YStack
                    alignItems="center"
                    gap={gtMd ? '$4' : '$2'}
                    mb={gtMd ? '$4' : '$2'}
                  >
                    <Image source={hyperliquidLogo} height={70} width={200} />

                    <SizableText
                      size={gtMd ? '$headingLg' : '$headingSm'}
                      textAlign="center"
                    >
                      {intl.formatMessage({
                        id: ETranslations.perp_term_title,
                      })}
                    </SizableText>
                  </YStack>

                  <YStack bg="$bgSubdued" borderRadius="$3">
                    <XStack alignItems="flex-start" gap="$3" p="$4">
                      <Checkbox
                        w="$4.5"
                        h="$4.5"
                        value={isAccountActivatedChecked}
                        onChange={(value) =>
                          setIsAccountActivatedChecked(!!value)
                        }
                        label={intl.formatMessage({
                          id: ETranslations.perp_term_content_1,
                        })}
                        labelProps={{
                          variant: gtMd ? '$bodyMd' : '$bodySm',
                        }}
                      />
                    </XStack>
                    <Divider borderColor="$borderSubdued" />
                    <XStack alignItems="flex-start" gap="$3" p="$4">
                      <Checkbox
                        w="$4.5"
                        h="$4.5"
                        value={isNotResponsibleChecked}
                        onChange={(value) =>
                          setIsNotResponsibleChecked(!!value)
                        }
                        label={intl.formatMessage({
                          id: ETranslations.perp_term_content_2,
                        })}
                        labelProps={{
                          variant: gtMd ? '$bodyMd' : '$bodySm',
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
                      {intl.formatMessage({
                        id: ETranslations.perp_term_content_3,
                      })}{' '}
                      <SizableText
                        size="$bodySm"
                        color="$textInteractive"
                        cursor="pointer"
                        onPress={() => {
                          openUrlExternal(TERMS_OF_SERVICE_URL);
                        }}
                        hoverStyle={{
                          borderBottomWidth: 1,
                          borderBottomColor: '$textInteractive',
                        }}
                        pressStyle={{
                          borderBottomWidth: 1,
                          borderBottomColor: '$textInteractive',
                        }}
                      >
                        {intl.formatMessage({
                          id: ETranslations.settings_user_agreement,
                        })}
                      </SizableText>{' '}
                      {intl.formatMessage({
                        id: ETranslations.perp_term_content_4,
                      })}{' '}
                      <SizableText
                        cursor="pointer"
                        hoverStyle={{
                          borderBottomWidth: 1,
                          borderBottomColor: '$textInteractive',
                        }}
                        pressStyle={{
                          borderBottomWidth: 1,
                          borderBottomColor: '$textInteractive',
                        }}
                        size="$bodySm"
                        color="$textInteractive"
                        onPress={() => {
                          openUrlExternal(PRIVACY_POLICY_URL);
                        }}
                      >
                        {intl.formatMessage({
                          id: ETranslations.global_privacy_policy,
                        })}
                      </SizableText>
                    </SizableText>
                  </XStack>
                </YStack>
              </Stack>
            </ScrollView>
            <XStack p="$6" justifyContent="center" pb="$4">
              <Button
                variant="primary"
                size="medium"
                flex={1}
                onPress={onConfirm}
                disabled={
                  !isAccountActivatedChecked || !isNotResponsibleChecked
                }
              >
                {intl.formatMessage({
                  id: ETranslations.perp_term_agree,
                })}
              </Button>
            </XStack>
          </YStack>
        ),
      },
    ];
  }, [
    HEIGHT_RATIO,
    gtMd,
    hyperliquidLogo,
    intl,
    isAccountActivatedChecked,
    isNotResponsibleChecked,
    onConfirm,
    overlayHeight,
  ]);

  const renderItem = useCallback(({ item }: { item: ISlideData }) => {
    return (
      <Stack alignItems="center" justifyContent="center" pb="$4">
        {item.content}
      </Stack>
    );
  }, []);

  const isConfirmationSlide = currentIndex === slidesData.length - 1;
  const canConfirm = isAccountActivatedChecked && isNotResponsibleChecked;

  const handlePageChanged = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      onPageIndexChange?.(index);
    },
    [onPageIndexChange],
  );

  const handleNext = useCallback(() => {
    if (isConfirmationSlide) {
      if (canConfirm) {
        onConfirm();
      }
      return;
    }
    carouselRef.current?.next();
    const nextIndex = currentIndex + 1;
    setTimeout(() => {
      setCurrentIndex(nextIndex);
      onPageIndexChange?.(nextIndex);
    }, 100);
  }, [
    isConfirmationSlide,
    currentIndex,
    onPageIndexChange,
    canConfirm,
    onConfirm,
  ]);

  return (
    <Stack onLayout={handleLayout}>
      <Stack
        minHeight={200}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <DelayedRender delay={renderDelay}>
          <Stack p="$4" height="100%" position="relative">
            <Carousel
              defaultIndex={0}
              showPagination={false}
              loop={false}
              ref={carouselRef}
              data={slidesData}
              renderItem={renderItem}
              pageWidth={layout.width}
              onPageChanged={handlePageChanged}
              containerStyle={{
                overflow: 'hidden',
                borderRadius: '$3',
              }}
              pagerProps={{
                scrollEnabled: false,
              }}
            />
            <Stack
              position="absolute"
              right={28}
              top={overlayHeight / 2}
              zIndex={1}
            >
              <AnimatePresence>
                {currentIndex !== slidesData.length - 1 ? (
                  <IconButton
                    size="small"
                    variant="primary"
                    icon="ChevronRightOutline"
                    iconColor="$green9"
                    borderWidth="$0.5"
                    onPress={handleNext}
                    pressStyle={{
                      scale: 0.95,
                    }}
                    hoverStyle={{
                      scale: 1,
                    }}
                  />
                ) : null}
              </AnimatePresence>
            </Stack>
          </Stack>
        </DelayedRender>
      </Stack>
    </Stack>
  );
}

export function HyperliquidTermsOverlay() {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(25);

  const handleConfirm = useCallback(() => {
    setIsVisible(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const checkTermsAccepted = async () => {
        const isTermsAccepted =
          await backgroundApiProxy.simpleDb.perp.getHyperliquidTermsAccepted();
        if (!isTermsAccepted) {
          setTimeout(() => {
            setIsVisible(true);
          }, 600);
        }
      };
      void checkTermsAccepted();
    }, []),
  );

  const onPageIndexChange = useCallback((index: number) => {
    setProgress(((index + 1) / 4) * 100);
  }, []);
  const HEIGHT_RATIO = useHeightRatio();
  const { width, height } = useWindowDimensions();
  const { gtMd } = useMedia();
  if (!isVisible) {
    return null;
  }
  const OVERLAY_HEIGHT = 600 * HEIGHT_RATIO;
  const maxHeight = Math.min(gtMd ? 600 : 480, height);
  const overlayHeight = OVERLAY_HEIGHT < maxHeight ? OVERLAY_HEIGHT : maxHeight;
  return (
    <Stack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="$bgBackdrop"
      zIndex={PERPS_TERMS_OVERLAY_Z_INDEX}
      alignItems="center"
      justifyContent="center"
      p="$6"
    >
      <Stack
        height={OVERLAY_HEIGHT}
        minWidth={Math.min(gtMd ? 340 : 320, width)}
        maxWidth={Math.min(gtMd ? 500 : 320, width)}
        maxHeight={maxHeight}
        bg="$bgApp"
        borderRadius="$4"
        overflow="hidden"
      >
        <Progress
          value={progress}
          indicatorColor="$textSuccess"
          progressColor="$bgApp"
          h={3}
        />
        <HyperliquidTermsContent
          overlayHeight={overlayHeight - 24}
          onPageIndexChange={onPageIndexChange}
          onConfirm={async () => {
            await backgroundApiProxy.simpleDb.perp.setHyperliquidTermsAccepted(
              true,
            );
            handleConfirm();
          }}
        />
      </Stack>
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
      <HyperliquidTermsContent
        overlayHeight={600}
        renderDelay={300}
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
