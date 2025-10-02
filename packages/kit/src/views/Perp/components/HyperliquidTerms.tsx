import { useCallback, useMemo, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import type { IRenderPaginationParams } from '@onekeyhq/components';
import {
  Button,
  Checkbox,
  Dialog,
  Divider,
  Image,
  Progress,
  ScrollView,
  SizableText,
  Stack,
  Swiper,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { DelayedRender } from '@onekeyhq/components/src/hocs/DelayedRender';
import { PERPS_TERMS_OVERLAY_Z_INDEX } from '@onekeyhq/shared/src/consts/zIndexConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import {
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePerpsLogo } from '../hooks/usePerpsLogo';

interface ISlideData {
  id: string;
  content: React.ReactNode;
}

const useHeightRatio = () => {
  const { height } = useWindowDimensions();
  return height / 800;
};

export function HyperliquidTermsContent({
  onConfirm,
  renderDelay = 0,
  onPageIndexChange,
}: {
  onConfirm: () => void;
  renderDelay?: number;
  onPageIndexChange?: (index: number) => void;
}) {
  const { gtMd } = useMedia();
  const intl = useIntl();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAccountActivatedChecked, setIsAccountActivatedChecked] =
    useState(false);
  const [isNotResponsibleChecked, setIsNotResponsibleChecked] = useState(false);

  const bannerHeight = useMemo(() => {
    return gtMd ? 300 : 250;
  }, [gtMd]);

  const bannerWidth = useMemo(() => {
    return gtMd ? 400 : 300;
  }, [gtMd]);

  const { hyperliquidLogo } = usePerpsLogo();

  const HEIGHT_RATIO = useHeightRatio();

  const slidesData = useMemo<ISlideData[]>(() => {
    const slideImageHeight = 400 * HEIGHT_RATIO;
    const slideImageMaxHeight = 400;
    const slide3StackHeight = 300 * HEIGHT_RATIO;
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
            <Stack
              height={slide3StackHeight}
              width={slide3StackHeight}
              maxHeight={300}
              maxWidth={300}
            >
              <Image
                source={require('@onekeyhq/kit/assets/perps/HL_intro_3.png')}
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
        id: 'confirmation-slide',
        content: (
          <Stack
            testID="hyperliquid-intro-confirmation-slide"
            alignItems="center"
            justifyContent="center"
            px="$4"
          >
            <YStack gap="$6">
              <YStack alignItems="center" gap="$4">
                <Image source={hyperliquidLogo} height={70} width={200} />

                <SizableText size="$bodyLgMedium" textAlign="center">
                  {intl.formatMessage({
                    id: ETranslations.perp_term_title,
                  })}
                </SizableText>
              </YStack>

              <YStack bg="$bgSubdued" borderRadius="$3">
                <XStack alignItems="flex-start" gap="$3" p="$4">
                  <Checkbox
                    value={isAccountActivatedChecked}
                    onChange={(value) => setIsAccountActivatedChecked(!!value)}
                    label={intl.formatMessage({
                      id: ETranslations.perp_term_content_1,
                    })}
                    labelProps={{
                      variant: '$bodyMd',
                    }}
                  />
                </XStack>
                <Divider />
                <XStack alignItems="flex-start" gap="$3" p="$4">
                  <Checkbox
                    value={isNotResponsibleChecked}
                    onChange={(value) => setIsNotResponsibleChecked(!!value)}
                    label={intl.formatMessage({
                      id: ETranslations.perp_term_content_2,
                    })}
                    labelProps={{
                      variant: '$bodyMd',
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
        ),
      },
    ];
  }, [
    HEIGHT_RATIO,
    bannerWidth,
    hyperliquidLogo,
    intl,
    isAccountActivatedChecked,
    isNotResponsibleChecked,
  ]);

  const keyExtractor = useCallback((item: ISlideData) => item.id, []);

  const renderItem = useCallback(({ item }: { item: ISlideData }) => {
    return (
      <Stack
        display="flex"
        alignItems="center"
        justifyContent="center"
        height="100%"
        pb="$4"
      >
        {item.content}
      </Stack>
    );
  }, []);

  const showPaginationButton = true;

  const isConfirmationSlide = currentIndex === slidesData.length - 1;
  const canConfirm = isAccountActivatedChecked && isNotResponsibleChecked;

  const renderPagination = useCallback(
    ({
      currentIndex: paginationCurrentIndex,
      goToNextIndex,
      gotToPrevIndex,
    }: IRenderPaginationParams) => (
      <YStack>
        {slidesData.length > 1 ? (
          <XStack
            testID="hyperliquid-intro-pagination"
            gap="$1"
            position="absolute"
            right={0}
            left={0}
            bottom={40}
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
            <XStack gap="$3" pt="$4" justifyContent="center">
              <Button
                variant="tertiary"
                size="small"
                onPress={() => {
                  onPageIndexChange?.(paginationCurrentIndex - 1);
                  gotToPrevIndex();
                }}
                disabled={currentIndex === 0}
              >
                {intl.formatMessage({
                  id: ETranslations.perp_term_previous,
                })}
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
                  onPageIndexChange?.(paginationCurrentIndex + 1);
                  goToNextIndex();
                }}
                disabled={isConfirmationSlide ? !canConfirm : null}
              >
                {isConfirmationSlide
                  ? intl.formatMessage({
                      id: ETranslations.perp_term_agree,
                    })
                  : intl.formatMessage({
                      id: ETranslations.global_next,
                    })}
              </Button>
            </XStack>
          </>
        ) : null}
      </YStack>
    ),
    [
      slidesData,
      showPaginationButton,
      currentIndex,
      intl,
      isConfirmationSlide,
      canConfirm,
      onPageIndexChange,
      onConfirm,
    ],
  );

  return (
    <Stack p="$4">
      <Stack
        minHeight={200}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <DelayedRender delay={renderDelay}>
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
  if (!isVisible) {
    return null;
  }
  const OVERLAY_HEIGHT = 600 * HEIGHT_RATIO;
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
        width={OVERLAY_HEIGHT / 1.2}
        height={OVERLAY_HEIGHT}
        maxWidth={500}
        maxHeight={600}
        bg="$bgApp"
        borderRadius="$4"
        overflow="hidden"
      >
        <Progress value={progress} indicatorColor="$textSuccess" h={3} />
        <ScrollView>
          <HyperliquidTermsContent
            onPageIndexChange={onPageIndexChange}
            onConfirm={async () => {
              await backgroundApiProxy.simpleDb.perp.setHyperliquidTermsAccepted(
                true,
              );
              handleConfirm();
            }}
          />
        </ScrollView>
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
