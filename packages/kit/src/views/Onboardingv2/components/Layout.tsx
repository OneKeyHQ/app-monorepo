import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import type {
  IKeyOfIcons,
  IPageProps,
  ISizableTextProps,
  IXStackProps,
  IYStackProps,
} from '@onekeyhq/components';
import {
  Button,
  Divider,
  Icon,
  IconButton,
  Page,
  ScrollView,
  Select,
  SizableText,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useLanguageSelectorWithoutAuto } from '../../Setting/hooks/useLanguageSelector';

// Electron drag-region helpers. On desktop, the header container is a window
// drag handle; interactive children opt out so they remain clickable.
const DRAG_STYLE = (
  platformEnv.isDesktop ? { WebkitAppRegion: 'drag' } : undefined
) as any;

const NO_DRAG_STYLE = (
  platformEnv.isDesktop ? { WebkitAppRegion: 'no-drag' } : undefined
) as any;

export const LayoutHeader = memo(
  ({ children, style, ...rest }: IXStackProps) => {
    const { top } = useSafeAreaInsets();
    return (
      <YStack pt={top || '$12'} style={DRAG_STYLE}>
        <XStack
          h={52}
          px="$5"
          alignItems="center"
          $gtMd={{
            px: '$12',
          }}
          {...rest}
          style={style}
        >
          {children}
        </XStack>
      </YStack>
    );
  },
);
LayoutHeader.displayName = 'LayoutHeader';

export const LayoutHeaderBack = memo(({ exit }: { exit?: boolean }) => {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();

  const icon = exit ? 'CrossedLargeOutline' : 'ArrowLeftOutline';

  const handleBack = useCallback(() => {
    navigation.pop();
  }, [navigation]);

  if (gtMd && !exit) {
    return (
      <Button
        size="small"
        icon={icon}
        variant="tertiary"
        onPress={handleBack}
        zIndex={1}
        style={NO_DRAG_STYLE}
      >
        {intl.formatMessage({ id: ETranslations.wallet_bulk_send_btn_back })}
      </Button>
    );
  }

  return (
    <IconButton
      size={gtMd ? 'small' : 'medium'}
      icon={icon}
      variant="tertiary"
      onPress={handleBack}
      zIndex={1}
      style={NO_DRAG_STYLE}
    />
  );
});
LayoutHeaderBack.displayName = 'LayoutHeaderBack';

export const LayoutHeaderTitle = memo(
  ({ children }: { children: React.ReactNode }) => (
    <YStack
      position="absolute"
      inset={0}
      zIndex={0}
      justifyContent="center"
      alignItems="center"
      px="$16"
    >
      <SizableText size="$headingLg" textAlign="center" numberOfLines={1}>
        {children}
      </SizableText>
    </YStack>
  ),
);
LayoutHeaderTitle.displayName = 'LayoutHeaderTitle';

export const LayoutHeaderLanguageSelector = memo(() => {
  const intl = useIntl();
  const { options, value, onChange } = useLanguageSelectorWithoutAuto();
  const { gtMd } = useMedia();

  const handleLanguageChange = useCallback(
    (v: string) => {
      setTimeout(() => {
        void onChange(v);
      }, 350);
    },
    [onChange],
  );

  return (
    <YStack ml="auto" style={NO_DRAG_STYLE}>
      <Select
        offset={{ mainAxis: 8, crossAxis: 8 }}
        title={intl.formatMessage({ id: ETranslations.global_language })}
        items={options}
        value={value}
        onChange={handleLanguageChange}
        placement="bottom-end"
        floatingPanelProps={{ maxHeight: 280 }}
        sheetProps={{ snapPoints: [80], snapPointsMode: 'percent' }}
        renderTrigger={({ label }) =>
          gtMd ? (
            <Button
              size="small"
              icon="GlobusOutline"
              variant="tertiary"
              ml="auto"
            >
              {label}
            </Button>
          ) : (
            <IconButton icon="GlobusOutline" variant="tertiary" ml="auto" />
          )
        }
      />
    </YStack>
  );
});
LayoutHeaderLanguageSelector.displayName = 'LayoutHeaderLanguageSelector';

export interface IOnboardingPageProps extends IPageProps {
  headerBack?: boolean | 'exit';
  headerTitle?: string;
  showLanguageSelector?: boolean;
  scrollable?: boolean;
  contentContainerProps?: IYStackProps;
  enterAnimation?: boolean;
  alignTop?: boolean;
  narrow?: boolean;
  backgroundLayer?: React.ReactNode;
  children: React.ReactNode;
}

export function OnboardingPage({
  headerBack = true,
  headerTitle,
  showLanguageSelector = true,
  scrollable = false,
  contentContainerProps,
  enterAnimation = true,
  alignTop = false,
  narrow = false,
  backgroundLayer,
  children,
  ...pageProps
}: IOnboardingPageProps) {
  const shouldAnimate = enterAnimation && !platformEnv.isNative;
  const contentArea = (
    <YStack
      flex={1}
      px="$5"
      $gtMd={{
        alignItems: 'center',
        justifyContent: alignTop ? 'flex-start' : 'center',
      }}
    >
      <YStack
        w="100%"
        maxWidth={800}
        mx="auto"
        $md={{ flex: 1 }}
        $gtMd={{
          minHeight: 600,
          ...(narrow && { py: '$10', maxWidth: 400 }),
        }}
        {...(shouldAnimate && {
          animation: 'quick',
          animateOnly: ANIMATE_ONLY_OPACITY_TRANSFORM,
          enterStyle: {
            opacity: 0,
            x: 24,
            filter: 'blur(4px)',
          },
        })}
        {...contentContainerProps}
      >
        {children}
      </YStack>
    </YStack>
  );

  return (
    <Page {...pageProps}>
      {backgroundLayer ? (
        <YStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          overflow="hidden"
          pointerEvents="none"
        >
          {backgroundLayer}
        </YStack>
      ) : null}
      <LayoutHeader>
        {headerBack !== false ? (
          <LayoutHeaderBack exit={headerBack === 'exit'} />
        ) : null}
        {headerTitle ? (
          <LayoutHeaderTitle>{headerTitle}</LayoutHeaderTitle>
        ) : null}
        {showLanguageSelector ? <LayoutHeaderLanguageSelector /> : null}
      </LayoutHeader>
      {scrollable ? (
        <ScrollView flex={1} contentContainerStyle={{ flexGrow: 1 }}>
          {contentArea}
        </ScrollView>
      ) : (
        contentArea
      )}
    </Page>
  );
}

export function OnboardingSidebar({
  $gtMd: userGtMd,
  children,
  ...rest
}: IYStackProps) {
  return (
    <YStack
      $gtMd={{
        w: '$80',
        ml: '$20',
        pl: '$8',
        borderLeftWidth: 2,
        borderLeftColor: '$borderSubdued',
        ...userGtMd,
      }}
      {...rest}
    >
      {children}
    </YStack>
  );
}

export interface IOnboardingIconBadgeProps extends Omit<
  IYStackProps,
  'children'
> {
  icon: IKeyOfIcons;
  iconColor?: React.ComponentProps<typeof Icon>['color'];
}

export function OnboardingIconBadge({
  icon,
  iconColor = '$bgApp',
  ...rest
}: IOnboardingIconBadgeProps) {
  return (
    <YStack
      bg="$brand10"
      p="$2"
      borderRadius="$full"
      alignSelf="flex-start"
      mb="$8"
      {...rest}
    >
      <Icon name={icon} color={iconColor} />
    </YStack>
  );
}

export function OnboardingHeading({
  children,
  ...rest
}: Omit<ISizableTextProps, 'size'>) {
  return (
    <SizableText size="$heading4xl" {...rest}>
      {children}
    </SizableText>
  );
}

export function OnboardingOrDivider() {
  const intl = useIntl();
  return (
    <XStack gap="$4" alignItems="center" px="$5">
      <Divider borderColor="$neutral3" flex={1} />
      <SizableText color="$textDisabled" size="$bodyLg">
        {intl.formatMessage({ id: ETranslations.global_or })}
      </SizableText>
      <Divider borderColor="$neutral3" flex={1} />
    </XStack>
  );
}

export function OnboardingPageFallback() {
  return <LayoutHeader />;
}
