import { useCallback, useMemo, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import type {
  IButtonProps,
  ICarouselInstance,
  IKeyOfIcons,
  IYStackProps,
} from '@onekeyhq/components';
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

function IndicatorButton({
  top,
  left,
  right,
  onPress,
  visible,
  iconName,
  variant,
}: {
  top: number;
  left?: number;
  right?: number;
  iconName: IKeyOfIcons;
  variant: IButtonProps['variant'];
  onPress: () => void;
  visible: boolean;
}) {
  return (
    <Stack position="absolute" left={left} top={top} right={right} zIndex={1}>
      <AnimatePresence>
        {visible ? (
          <IconButton
            size="small"
            variant={variant}
            icon={iconName}
            iconColor="$green9"
            borderWidth="$0.5"
            onPress={onPress}
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
  );
}

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
    const slideImageHeight = gtMd ? 400 : 350;
    // const slideImageHeight = gtMd ? 450 : 350;
    const bannerWidth = gtMd ? Math.max(slideImageHeight, 340) : 300;
    const textPadding = gtMd ? '$5' : '$4';
    const textHeadingSize = gtMd ? '$heading3xl' : '$heading2xl';
    const textBodySize = gtMd ? '$bodyLg' : '$bodyMd';
    const textHeadingMarginTop = gtMd ? '$-8' : '$-6';
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
            <Stack>
              <Image
                source={require('@onekeyhq/kit/assets/perps/HL_intro_1.png')}
                // size={slideImageHeight}
                height={slideImageHeight}
                width={slideImageHeight}
              />
            </Stack>
            <YStack
              gap="$2"
              px={textPadding}
              w={bannerWidth}
              justifyContent="flex-start"
              mt={textHeadingMarginTop}
            >
              <SizableText size={textHeadingSize}>
                {intl.formatMessage({
                  id: ETranslations.perp_intro_profesional_title,
                })}
              </SizableText>
              <SizableText size={textBodySize} color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_intro_profesional_msg,
                })}
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
                source={require('@onekeyhq/kit/assets/perps/HL_intro_4.png')}
                size={slideImageHeight}
                resizeMode="contain"
              />
            </Stack>
            <YStack
              gap="$2"
              justifyContent="flex-start"
              w={bannerWidth}
              px={textPadding}
              mt={textHeadingMarginTop}
            >
              <SizableText size={textHeadingSize}>
                {intl.formatMessage({
                  id: ETranslations.perp_intro_leverage_title,
                })}
              </SizableText>
              <SizableText size={textBodySize} color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_intro_leverage_msg,
                })}
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
                source={require('@onekeyhq/kit/assets/perps/HL_intro_2.png')}
                size={slideImageHeight}
                resizeMode="contain"
              />
            </Stack>
            <YStack
              gap="$2"
              justifyContent="flex-start"
              w={bannerWidth}
              px={textPadding}
              mt={textHeadingMarginTop}
            >
              <SizableText size={textHeadingSize}>
                {intl.formatMessage({
                  id: ETranslations.perp_intro_trade_title,
                })}
              </SizableText>
              <SizableText size={textBodySize} color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_intro_trade_msg,
                })}
              </SizableText>
            </YStack>
          </Stack>
        ),
      },
      {
        id: 'slide-4',
        content: (
          <Stack alignItems="center" justifyContent="center" px="$6">
            <Stack
              height={slideImageHeight}
              width={slideImageHeight}
              alignItems="center"
              justifyContent="center"
            >
              <Image
                source={require('@onekeyhq/kit/assets/perps/HL_intro_3.png')}
                size={slideImageHeight / 1.4}
                resizeMode="contain"
              />
            </Stack>
            <YStack
              gap="$2"
              justifyContent="flex-start"
              w={bannerWidth}
              px={textPadding}
              mt={textHeadingMarginTop}
            >
              <SizableText size={textHeadingSize}>
                {intl.formatMessage({
                  id: ETranslations.perp_intro_fast_title,
                })}
              </SizableText>
              <SizableText size={textBodySize} color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_intro_fast_msg,
                })}
              </SizableText>
            </YStack>
          </Stack>
        ),
      },
      {
        id: 'confirmation-slide',
        content: (
          <YStack {...confirmationSlideStyle}>
            <Stack
              testID="hyperliquid-intro-confirmation-slide"
              alignItems="center"
              justifyContent="center"
              px="$8"
            >
              <YStack gap={gtMd ? '$3' : '$2'}>
                <YStack
                  alignItems="center"
                  gap={gtMd ? '$4' : '$2'}
                  mb={gtMd ? '$4' : '$2'}
                >
                  <Stack py={gtMd ? '$6' : '$4'} justifyContent="center">
                    <Image
                      source={hyperliquidLogo}
                      height={gtMd ? 50 : 40}
                      width={gtMd ? 300 : 250}
                      resizeMode="contain"
                    />
                  </Stack>
                  <SizableText
                    size={gtMd ? '$headingLg' : '$headingXs'}
                    textAlign="center"
                  >
                    {intl.formatMessage({
                      id: ETranslations.perp_term_title,
                    })}
                  </SizableText>
                </YStack>

                <YStack
                  maxWidth="100%"
                  px="$3"
                  bg="$bgSubdued"
                  borderRadius="$3"
                >
                  <YStack alignItems="flex-start" p="$4">
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
                  </YStack>
                  <Divider borderColor="$borderSubdued" />
                  <YStack alignItems="flex-start" p="$4">
                    <Checkbox
                      w="$4.5"
                      h="$4.5"
                      value={isNotResponsibleChecked}
                      onChange={(value) => setIsNotResponsibleChecked(!!value)}
                      label={intl.formatMessage({
                        id: ETranslations.perp_term_content_2,
                      })}
                      labelProps={{
                        variant: gtMd ? '$bodyMd' : '$bodySm',
                      }}
                    />
                  </YStack>
                </YStack>
              </YStack>
            </Stack>
            <YStack
              p="$8"
              justifyContent="center"
              pb={gtMd ? '$4' : '$1'}
              gap="$1"
            >
              <Button
                variant="primary"
                size="medium"
                w="100%"
                onPress={onConfirm}
                disabled={
                  !isAccountActivatedChecked || !isNotResponsibleChecked
                }
              >
                {intl.formatMessage({
                  id: ETranslations.perp_term_agree,
                })}
              </Button>

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
          </YStack>
        ),
      },
    ];
  }, [
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
      <ScrollView>
        <Stack alignItems="center" justifyContent="center" pb="$4">
          {item.content}
        </Stack>
      </ScrollView>
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

  const handlePrev = useCallback(() => {
    carouselRef.current?.prev();
    const prevIndex = currentIndex - 1;
    setTimeout(() => {
      handlePageChanged(prevIndex);
    }, 100);
  }, [currentIndex, handlePageChanged]);

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
      handlePageChanged(nextIndex);
    }, 100);
  }, [
    isConfirmationSlide,
    currentIndex,
    canConfirm,
    onConfirm,
    handlePageChanged,
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
            <IndicatorButton
              top={overlayHeight / 2}
              left={28}
              iconName="ChevronLeftOutline"
              variant="secondary"
              onPress={handlePrev}
              visible={currentIndex !== 0}
            />
            <IndicatorButton
              top={overlayHeight / 2}
              right={28}
              iconName="ChevronRightOutline"
              variant="primary"
              onPress={handleNext}
              visible={currentIndex !== slidesData.length - 1}
            />
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
    setProgress(((index + 1) / 5) * 100);
  }, []);
  const { width } = useWindowDimensions();
  const { gtMd } = useMedia();
  if (!isVisible) {
    return null;
  }

  const minHeight = 500;

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
        height={minHeight}
        width={Math.min(gtMd ? 460 : 320, width)}
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
          overlayHeight={minHeight - 24}
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
