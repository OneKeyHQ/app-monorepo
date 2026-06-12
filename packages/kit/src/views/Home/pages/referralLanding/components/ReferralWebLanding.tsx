import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  Illustration,
  LottieView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import type {
  IIllustrationName,
  IKeyOfIcons,
  ISizableTextProps,
} from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { HomeTestIDs } from '@onekeyhq/kit/src/views/Home/testIDs';
import { LayoutHeaderLanguageSelector } from '@onekeyhq/kit/src/views/Onboardingv2/components/Layout';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const LOTTIE_SOURCE = {
  light: require('@onekeyhq/kit/assets/animations/_mov_refer.json'),
  dark: require('@onekeyhq/kit/assets/animations/_mov_refer_dark.json'),
};
const LOTTIE_ASPECT_RATIO = 786 / 446;

const VARIANT_COPY = {
  perps: {
    heroTitleId: ETranslations.referral_web_landing_title_perps,
    heroSubtitleId: ETranslations.referral_web_landing_subtitle_perps,
    step3TitleId: ETranslations.referral_web_landing_step3_perps_title,
    step3CtaId: ETranslations.referral_web_landing_step3_perps_cta,
    step3Illustration: 'BlockPercentage' satisfies IIllustrationName,
  },
  defi: {
    heroTitleId: ETranslations.referral_web_landing_title_defi,
    heroSubtitleId: ETranslations.referral_web_landing_subtitle_defi,
    step3TitleId: ETranslations.referral_web_landing_step3_defi_title,
    step3CtaId: ETranslations.referral_web_landing_step3_defi_cta,
    step3Illustration: 'BlockCoins' satisfies IIllustrationName,
  },
} as const;

export type IReferralVariant = keyof typeof VARIANT_COPY;

const STEP_BUTTON_SIZE = {
  size: 'large',
  $gtMd: { size: 'medium' },
} as const;

const REFERRAL_CARD_WEB_SHADOW =
  'inset 0 1px 0 0 rgba(255, 255, 255, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.06), 0 1px 1px -0.5px rgba(0, 0, 0, 0.06), 0 3px 3px -1.5px rgba(0, 0, 0, 0.06)';

const PERPS_BENEFITS: {
  icon: IKeyOfIcons;
  titleId: ETranslations;
  descriptionId: ETranslations;
}[] = [
  {
    icon: 'ChartTrendingUpOutline',
    titleId: ETranslations.referral_web_landing_perps_all_asset__title,
    descriptionId: ETranslations.referral_web_landing_perps_all_asset__desc,
  },
  {
    icon: 'StarOutline',
    titleId: ETranslations.referral_web_landing_perps_backed__title,
    descriptionId: ETranslations.referral_web_landing_perps_backed__desc,
  },
  {
    icon: 'WalletOutline',
    titleId: ETranslations.referral_web_landing_perps_wallet_native__title,
    descriptionId: ETranslations.referral_web_landing_perps_wallet_native__desc,
  },
  {
    icon: 'ClockTimeHistoryOutline',
    titleId: ETranslations.referral_web_landing_perps_global_markets__title,
    descriptionId:
      ETranslations.referral_web_landing_perps_global_markets__desc,
  },
  {
    icon: 'ShieldOutline',
    titleId: ETranslations.referral_web_landing_perps_self_custody__title,
    descriptionId: ETranslations.referral_web_landing_perps_self_custody__desc,
  },
];

const buildAccentChunks = (
  sizeProps: Pick<ISizableTextProps, 'size' | '$gtMd'>,
) => ({
  accent: (chunks: React.ReactNode) => (
    <SizableText {...sizeProps} color="$brand10">
      {chunks}
    </SizableText>
  ),
});

function StepBadge({ number }: { number: number }) {
  return (
    <Stack
      bg="$brand2"
      borderWidth={1}
      borderColor="$brand5"
      w="$8"
      h="$8"
      borderRadius="$2"
      alignItems="center"
      justifyContent="center"
    >
      <SizableText size="$bodyMdMedium" color="$brand10">
        {`0${number}`}
      </SizableText>
    </Stack>
  );
}

function StepIllustration({ name }: { name: IIllustrationName }) {
  // Hide below 1024px so step cards have room for content.
  return (
    <Stack $lg={{ display: 'none' }} flexShrink={0}>
      <Illustration name={name} size={104} />
    </Stack>
  );
}

function StepCard({
  stepNumber,
  title,
  illustration,
  children,
}: {
  stepNumber: number;
  title: React.ReactNode;
  illustration: IIllustrationName;
  children: React.ReactNode;
}) {
  return (
    <XStack
      bg="$bg"
      borderRadius="$4"
      borderCurve="continuous"
      p="$5"
      gap="$4"
      alignItems="center"
      $platform-web={{
        boxShadow: REFERRAL_CARD_WEB_SHADOW,
      }}
    >
      <YStack flex={1} gap="$4">
        <XStack alignItems="center" gap="$3">
          <StepBadge number={stepNumber} />
          <SizableText size="$headingXl" flex={1}>
            {title}
          </SizableText>
        </XStack>
        {children}
      </YStack>
      <StepIllustration name={illustration} />
    </XStack>
  );
}

function ReferralLottieAnimation() {
  const themeVariant = useThemeVariant();
  const lottieSource =
    LOTTIE_SOURCE[themeVariant === 'dark' ? 'dark' : 'light'];
  return (
    <Stack
      width="100%"
      maxWidth={480}
      aspectRatio={LOTTIE_ASPECT_RATIO}
      alignSelf="flex-start"
      $md={{ alignSelf: 'center' }}
    >
      <LottieView
        source={lottieSource}
        autoplay={false}
        loop={false}
        initialSegment={[30, 30]}
        resizeMode="contain"
        width="100%"
        height="100%"
      />
    </Stack>
  );
}

function ReferralHero({
  variant,
  discount,
}: {
  variant: IReferralVariant;
  discount: string;
}) {
  const intl = useIntl();
  const copy = VARIANT_COPY[variant];
  return (
    <YStack
      gap="$4"
      $gtMd={{
        flexBasis: 0,
        flexGrow: 45,
        gap: '$4',
        justifyContent: 'center',
      }}
    >
      <ReferralLottieAnimation />
      <SizableText
        size="$bodyMdMedium"
        $gtMd={{ size: '$bodyLgMedium', textAlign: 'left' }}
        color="$textSubdued"
        fontWeight={400}
        textAlign="center"
      >
        {intl.formatMessage({ id: copy.heroTitleId })}
      </SizableText>
      <SizableText
        size="$heading4xl"
        $gtMd={{ size: '$heading5xl', textAlign: 'left' }}
        textAlign="center"
      >
        {intl.formatMessage(
          {
            id: copy.heroSubtitleId,
          },
          {
            ...buildAccentChunks({
              size: '$heading4xl',
              $gtMd: { size: '$heading5xl' },
            }),
            discount,
          },
        )}
      </SizableText>
    </YStack>
  );
}

const DOWNLOAD_COPY: {
  icon: IKeyOfIcons;
  labelId: ETranslations;
} = (() => {
  if (platformEnv.isWebMobileIOS) {
    return {
      icon: 'AppleBrand',
      labelId: ETranslations.referral_web_landing_step1_appstore,
    };
  }
  if (platformEnv.isWebMobileAndroid) {
    return {
      icon: 'GooglePlayBrand',
      labelId: ETranslations.referral_web_landing_step1_googleplay,
    };
  }
  return {
    icon: 'DownloadOutline',
    labelId: ETranslations.referral_web_landing_step1_download_desktop,
  };
})();

function Step1Download({
  onDownload,
  onScrollToBind,
}: {
  onDownload: () => void;
  onScrollToBind: () => void;
}) {
  const intl = useIntl();
  return (
    <StepCard
      stepNumber={1}
      illustration="WalletAdd"
      title={intl.formatMessage({
        id: ETranslations.referral_web_landing_step1_title,
      })}
    >
      <YStack gap="$3">
        <Button
          testID={HomeTestIDs.referralLandingDownloadBtn}
          variant="accent"
          {...STEP_BUTTON_SIZE}
          icon={DOWNLOAD_COPY.icon}
          onPress={onDownload}
        >
          {intl.formatMessage({
            id: DOWNLOAD_COPY.labelId,
          })}
        </Button>
        <Stack
          onPress={onScrollToBind}
          alignItems="center"
          justifyContent="center"
          py="$1"
          userSelect="none"
          hoverStyle={{ opacity: 0.7 }}
          pressStyle={{ opacity: 0.5 }}
        >
          <SizableText size="$bodyLgMedium" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.referral_web_landing_step1_already_have_wallet,
            })}
          </SizableText>
        </Stack>
      </YStack>
    </StepCard>
  );
}

function Step2BindCode({
  code,
  onCopyCode,
  onBind,
}: {
  code?: string;
  onCopyCode: () => void;
  onBind: () => void;
}) {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const handleCopy = useCallback(() => {
    if (!code) return;
    copyText(code);
    onCopyCode();
  }, [code, copyText, onCopyCode]);
  return (
    <StepCard
      stepNumber={2}
      illustration="ShakeHands"
      title={intl.formatMessage({
        id: ETranslations.referral_web_landing_step2_title,
      })}
    >
      <XStack
        bg="$bgStrong"
        borderRadius="$3"
        px="$4"
        py="$3"
        alignItems="center"
        gap="$3"
        userSelect="none"
        onPress={handleCopy}
        disabled={!code}
        hoverStyle={{ bg: '$bgStrongHover' }}
        pressStyle={{ bg: '$bgStrongActive' }}
      >
        <SizableText
          size="$headingXl"
          $gtMd={{ size: '$heading2xl' }}
          color={code ? '$text' : '$textDisabled'}
          flex={1}
          letterSpacing={2}
          numberOfLines={1}
        >
          {code || '------'}
        </SizableText>
        <XStack alignItems="center" gap="$1.5">
          <Icon
            name="Copy1Outline"
            size="$5"
            color={code ? '$iconSubdued' : '$iconDisabled'}
          />
          <SizableText
            size="$bodyMdMedium"
            color={code ? '$textSubdued' : '$textDisabled'}
          >
            {intl.formatMessage({ id: ETranslations.global_copy })}
          </SizableText>
        </XStack>
      </XStack>
      <Button
        testID={HomeTestIDs.referralLandingBindBtn}
        variant="primary"
        {...STEP_BUTTON_SIZE}
        onPress={onBind}
        disabled={!code}
      >
        {intl.formatMessage({
          id: ETranslations.referral_web_landing_step2_bind,
        })}
      </Button>
    </StepCard>
  );
}

function Step2DownloadHint({ onDownload }: { onDownload: () => void }) {
  const intl = useIntl();
  return (
    <XStack
      bg="$bgSubdued"
      borderRadius="$3"
      px="$4"
      py="$3"
      gap="$2"
      alignItems="center"
      justifyContent="center"
      flexWrap="wrap"
    >
      <SizableText size="$bodyMdMedium" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.referral_web_landing_app_open_hint,
        })}
      </SizableText>
      <Button
        size="small"
        variant="tertiary"
        onPress={onDownload}
        testID={HomeTestIDs.referralLandingDownloadHintBtn}
      >
        {intl.formatMessage({
          id: ETranslations.referral_web_landing_step1_title,
        })}
      </Button>
    </XStack>
  );
}

function Step3Trade({
  variant,
  discount,
  onTrade,
}: {
  variant: IReferralVariant;
  discount: string;
  onTrade: () => void;
}) {
  const intl = useIntl();
  const copy = VARIANT_COPY[variant];
  return (
    <StepCard
      stepNumber={3}
      illustration={copy.step3Illustration}
      title={intl.formatMessage(
        {
          id: copy.step3TitleId,
        },
        {
          ...buildAccentChunks({ size: '$headingXl' }),
          discount,
        },
      )}
    >
      <Button
        testID={HomeTestIDs.referralLandingTradeBtn}
        variant="secondary"
        {...STEP_BUTTON_SIZE}
        onPress={onTrade}
      >
        {intl.formatMessage({
          id: copy.step3CtaId,
        })}
      </Button>
    </StepCard>
  );
}

function PerpsBenefitIcon({ name }: { name: IKeyOfIcons }) {
  return (
    <Stack
      w="$10"
      h="$10"
      borderRadius="$full"
      bg="$brand2"
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
    >
      <Icon name={name} size="$5" color="$brand10" />
    </Stack>
  );
}

function PerpsBenefitCard({
  benefit,
}: {
  benefit: (typeof PERPS_BENEFITS)[number];
}) {
  const intl = useIntl();
  return (
    <YStack
      bg="$bg"
      borderRadius="$4"
      borderCurve="continuous"
      p="$5"
      gap="$3"
      minWidth={0}
      flexBasis="100%"
      flexGrow={1}
      $gtMd={{ flexBasis: '30%' }}
      $platform-web={{
        boxShadow: REFERRAL_CARD_WEB_SHADOW,
      }}
    >
      <PerpsBenefitIcon name={benefit.icon} />
      <YStack gap="$2">
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: benefit.titleId })}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: benefit.descriptionId })}
        </SizableText>
      </YStack>
    </YStack>
  );
}

function PerpsBenefitsSection() {
  const intl = useIntl();
  return (
    <YStack gap="$5" w="100%" pt="$6" $gtMd={{ pt: '$8' }}>
      <YStack gap="$2" maxWidth={680} alignSelf="center" alignItems="center">
        <SizableText
          size="$heading3xl"
          $gtMd={{ size: '$heading4xl' }}
          textAlign="center"
        >
          {intl.formatMessage({
            id: ETranslations.referral_web_landing_perps_benefits__title,
          })}
        </SizableText>
        <SizableText size="$bodyLg" color="$textSubdued" textAlign="center">
          {intl.formatMessage({
            id: ETranslations.referral_web_landing_perps_benefits__desc,
          })}
        </SizableText>
      </YStack>
      <XStack gap="$4" flexWrap="wrap">
        {PERPS_BENEFITS.map((benefit) => (
          <PerpsBenefitCard key={benefit.titleId} benefit={benefit} />
        ))}
      </XStack>
    </YStack>
  );
}

export const REFERRAL_STEP2_ANCHOR_ID = 'referral-landing-step2';

export interface IReferralWebLandingProps {
  code?: string;
  variant: IReferralVariant;
  inviteeDiscount: string;
  onDownload: () => void;
  onScrollToBind: () => void;
  onCopyCode: () => void;
  onBind: () => void;
  onTrade: () => void;
  isStep2Highlighted?: boolean;
  isDownloadHintVisible?: boolean;
}

export function ReferralWebLanding({
  code,
  variant,
  inviteeDiscount,
  onDownload,
  onScrollToBind,
  onCopyCode,
  onBind,
  onTrade,
  isStep2Highlighted = false,
  isDownloadHintVisible = false,
}: IReferralWebLandingProps) {
  return (
    <YStack flex={1}>
      <XStack h={52} px="$5" ai="center" jc="space-between">
        <Stack
          aria-label="OneKey home"
          onPress={() => {
            if (typeof globalThis.location !== 'undefined') {
              globalThis.location.href = '/';
            }
          }}
          hoverStyle={{ opacity: 0.7 }}
          pressStyle={{ opacity: 0.5 }}
        >
          <Icon name="OnekeyTextIllus" color="$text" h={28} w={102} />
        </Stack>
        <LayoutHeaderLanguageSelector />
      </XStack>
      <YStack
        flex={1}
        maxWidth={1080}
        mx="auto"
        w="100%"
        px="$5"
        pb="$8"
        gap="$8"
        $gtMd={{
          gap: '$10',
          px: '$8',
          pb: '$16',
        }}
      >
        <YStack
          w="100%"
          gap="$8"
          $gtMd={{
            flexDirection: 'row',
            gap: '$12',
          }}
        >
          <ReferralHero variant={variant} discount={inviteeDiscount} />
          <YStack gap="$5" $gtMd={{ flexBasis: 0, flexGrow: 55, pt: '$16' }}>
            <Step1Download
              onDownload={onDownload}
              onScrollToBind={onScrollToBind}
            />
            <Stack
              nativeID={REFERRAL_STEP2_ANCHOR_ID}
              borderRadius="$4"
              $platform-web={{
                transition: 'box-shadow 0.4s ease-out',
                boxShadow: isStep2Highlighted
                  ? '0 0 0 3px rgba(73, 223, 88, 0.55), 0 0 24px 0 rgba(73, 223, 88, 0.18)'
                  : '0 0 0 0 rgba(73, 223, 88, 0)',
              }}
            >
              <Step2BindCode
                code={code}
                onCopyCode={onCopyCode}
                onBind={onBind}
              />
            </Stack>
            {isDownloadHintVisible ? (
              <Step2DownloadHint onDownload={onDownload} />
            ) : null}
            <Step3Trade
              variant={variant}
              discount={inviteeDiscount}
              onTrade={onTrade}
            />
          </YStack>
        </YStack>
        {variant === 'perps' ? <PerpsBenefitsSection /> : null}
      </YStack>
    </YStack>
  );
}
