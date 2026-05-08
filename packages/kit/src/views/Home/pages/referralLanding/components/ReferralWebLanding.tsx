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
import { LayoutHeaderLanguageSelector } from '@onekeyhq/kit/src/views/Onboardingv2/components/Layout';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const LOTTIE_SOURCE = {
  light: require('@onekeyhq/kit/assets/animations/_mov_refer.json'),
  dark: require('@onekeyhq/kit/assets/animations/_mov_refer_dark.json'),
};
const LOTTIE_ASPECT_RATIO = 786 / 446;

const VARIANT_COPY = {
  perps: {
    heroTitleId: 'referral.web_landing_title_perps' as ETranslations,
    heroTitleDefault:
      "You're invited! Enjoy <accent>{discount}</accent> Perps rebate",
    step3TitleId: 'referral.web_landing_step3_perps_title' as ETranslations,
    step3TitleDefault:
      'Trade and get <accent>{discount}</accent> back automatically',
    step3CtaId: 'referral.web_landing_step3_perps_cta' as ETranslations,
    step3CtaDefault: 'Trade now',
    step3Illustration: 'BlockPercentage' satisfies IIllustrationName,
  },
  defi: {
    heroTitleId: 'referral.web_landing_title_defi' as ETranslations,
    heroTitleDefault:
      "You're invited! Enjoy <accent>{discount}</accent> DeFi rebates",
    step3TitleId: 'referral.web_landing_step3_defi_title' as ETranslations,
    step3TitleDefault:
      'Earn and get <accent>{discount}</accent> more — automatically',
    step3CtaId: 'referral.web_landing_step3_defi_cta' as ETranslations,
    step3CtaDefault: 'Earn now',
    step3Illustration: 'BlockCoins' satisfies IIllustrationName,
  },
} as const;

export type IReferralVariant = keyof typeof VARIANT_COPY;

const STEP_BUTTON_SIZE = {
  size: 'large',
  $gtMd: { size: 'medium' },
} as const;

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
        boxShadow:
          'inset 0 1px 0 0 rgba(255, 255, 255, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.06), 0 1px 1px -0.5px rgba(0, 0, 0, 0.06), 0 3px 3px -1.5px rgba(0, 0, 0, 0.06)',
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
        gap: '$5',
        justifyContent: 'center',
      }}
    >
      <ReferralLottieAnimation />
      <SizableText size="$heading4xl" $gtMd={{ size: '$heading5xl' }}>
        {intl.formatMessage(
          {
            id: copy.heroTitleId,
            defaultMessage: copy.heroTitleDefault,
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
      <SizableText size="$bodyLg" color="$textSubdued">
        {intl.formatMessage({
          id: 'referral.web_landing_subtitle' as ETranslations,
          defaultMessage:
            'A friend invited you. Complete these steps to claim your rebate.',
        })}
      </SizableText>
    </YStack>
  );
}

const DOWNLOAD_COPY: {
  icon: IKeyOfIcons;
  labelId: ETranslations;
  labelDefault: string;
} = (() => {
  if (platformEnv.isWebMobileIOS) {
    return {
      icon: 'AppleBrand',
      labelId: 'referral.web_landing_step1_appstore' as ETranslations,
      labelDefault: 'Download from App Store',
    };
  }
  if (platformEnv.isWebMobileAndroid) {
    return {
      icon: 'GooglePlayBrand',
      labelId: 'referral.web_landing_step1_googleplay' as ETranslations,
      labelDefault: 'Download from Google Play',
    };
  }
  return {
    icon: 'DownloadOutline',
    labelId: 'referral.web_landing_step1_download_desktop' as ETranslations,
    labelDefault: 'Download OneKey',
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
        id: 'referral.web_landing_step1_title' as ETranslations,
        defaultMessage: 'Download OneKey App',
      })}
    >
      <YStack gap="$3">
        <Button
          variant="accent"
          {...STEP_BUTTON_SIZE}
          icon={DOWNLOAD_COPY.icon}
          onPress={onDownload}
        >
          {intl.formatMessage({
            id: DOWNLOAD_COPY.labelId,
            defaultMessage: DOWNLOAD_COPY.labelDefault,
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
              id: 'referral.web_landing_step1_already_have_wallet' as ETranslations,
              defaultMessage: 'I already have a wallet',
            })}
          </SizableText>
        </Stack>
      </YStack>
    </StepCard>
  );
}

function Step2BindCode({
  code,
  onBind,
}: {
  code?: string;
  onBind: () => void;
}) {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const handleCopy = useCallback(() => {
    if (!code) return;
    copyText(code);
    defaultLogger.referral.page.copyReferralCode();
  }, [code, copyText]);
  return (
    <StepCard
      stepNumber={2}
      illustration="ShakeHands"
      title={intl.formatMessage({
        id: 'referral.web_landing_step2_title' as ETranslations,
        defaultMessage: 'Apply your referral reward',
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
        variant="primary"
        {...STEP_BUTTON_SIZE}
        onPress={onBind}
        disabled={!code}
      >
        {intl.formatMessage({
          id: 'referral.web_landing_step2_bind' as ETranslations,
          defaultMessage: 'Apply',
        })}
      </Button>
    </StepCard>
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
          defaultMessage: copy.step3TitleDefault,
        },
        {
          ...buildAccentChunks({ size: '$headingXl' }),
          discount,
        },
      )}
    >
      <Button variant="secondary" {...STEP_BUTTON_SIZE} onPress={onTrade}>
        {intl.formatMessage({
          id: copy.step3CtaId,
          defaultMessage: copy.step3CtaDefault,
        })}
      </Button>
    </StepCard>
  );
}

export const REFERRAL_STEP2_ANCHOR_ID = 'referral-landing-step2';

export interface IReferralWebLandingProps {
  code?: string;
  variant: IReferralVariant;
  inviteeDiscount: string;
  onDownload: () => void;
  onScrollToBind: () => void;
  onBind: () => void;
  onTrade: () => void;
  isStep2Highlighted?: boolean;
}

export function ReferralWebLanding({
  code,
  variant,
  inviteeDiscount,
  onDownload,
  onScrollToBind,
  onBind,
  onTrade,
  isStep2Highlighted = false,
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
          flexDirection: 'row',
          gap: '$12',
          px: '$8',
          pb: '$16',
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
            <Step2BindCode code={code} onBind={onBind} />
          </Stack>
          <Step3Trade
            variant={variant}
            discount={inviteeDiscount}
            onTrade={onTrade}
          />
        </YStack>
      </YStack>
    </YStack>
  );
}
