import { memo, useCallback } from 'react';

import { useNavigationState } from '@react-navigation/native';
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
  KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET,
  Keyboard,
  Page,
  Select,
  SizableText,
  XStack,
  YStack,
  useLiquidGlassHeaderTopInset,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useLanguageSelectorWithoutAuto } from '../../Setting/hooks/useLanguageSelector';
import { OnboardingTestIDs } from '../testIDs';

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
    if (exit) {
      defaultLogger.account.wallet.onboardingExit();
    }
    navigation.pop();
  }, [navigation, exit]);

  if (gtMd && !exit) {
    return (
      <Button
        testID={OnboardingTestIDs.layoutHeaderBackBtn}
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
      testID={OnboardingTestIDs.layoutHeaderBackBtn}
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
        testID={OnboardingTestIDs.layoutHeaderLanguageSelector}
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
              testID={OnboardingTestIDs.layoutHeaderLanguageBtn}
              size="small"
              icon="GlobusOutline"
              variant="tertiary"
              ml="auto"
            >
              {label}
            </Button>
          ) : (
            <IconButton
              testID={OnboardingTestIDs.layoutHeaderLanguageIconBtn}
              icon="GlobusOutline"
              variant="tertiary"
              ml="auto"
            />
          )
        }
      />
    </YStack>
  );
});
LayoutHeaderLanguageSelector.displayName = 'LayoutHeaderLanguageSelector';

// Back/exit affordance for the iOS 26 native (Liquid Glass) onboarding header.
// Icon-only (unlike LayoutHeaderBack, which renders a text "Back" button on
// gtMd) so it sits cleanly in the system glass capsule, while preserving the
// onboardingExit analytics + the back-vs-exit (arrow vs cross) distinction.
const OnboardingNativeHeaderBack = memo(({ exit }: { exit?: boolean }) => {
  const navigation = useAppNavigation();
  const handleBack = useCallback(() => {
    if (exit) {
      defaultLogger.account.wallet.onboardingExit();
    }
    navigation.pop();
  }, [navigation, exit]);
  return (
    <IconButton
      testID={OnboardingTestIDs.layoutHeaderBackBtn}
      icon={exit ? 'CrossedLargeOutline' : 'ArrowLeftOutline'}
      variant="tertiary"
      onPress={handleBack}
    />
  );
});
OnboardingNativeHeaderBack.displayName = 'OnboardingNativeHeaderBack';

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
  /**
   * Extra offset above the keyboard. Increase when a Page.Footer is rendered
   * so the focused input clears the footer area, not just the keyboard.
   */
  keyboardBottomOffset?: number;
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
  keyboardBottomOffset = KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET,
  children,
  ...pageProps
}: IOnboardingPageProps) {
  const shouldAnimate = enterAnimation && !platformEnv.isNative;
  const glassTopInset = useLiquidGlassHeaderTopInset();
  // The first screen in the onboarding stack has no native back button (no
  // in-stack history), so the shell supplies the back/exit icon there. Deeper
  // screens use the native system back (chevron), present from the first frame
  // — avoiding a chevron->arrow swap when the shell would otherwise override it.
  const isFirstScreen = useNavigationState((state) => state.index) === 0;

  // On iOS 26 the onboarding header moves into the native nav bar so it gets the
  // Liquid Glass material; every other platform keeps the self-drawn
  // LayoutHeader. An "empty" header (no back, no title, no language — e.g.
  // FinalizeWalletSetup) stays self-drawn so it doesn't show a bare native bar.
  const isEmptyHeader =
    headerBack === false && !headerTitle && !showLanguageSelector;
  const useNativeHeader = platformEnv.isNativeIOS26Plus && !isEmptyHeader;

  const renderNativeHeaderLeft = useCallback(
    () => <OnboardingNativeHeaderBack exit={headerBack === 'exit'} />,
    [headerBack],
  );
  const renderNativeHeaderRight = useCallback(
    () => <LayoutHeaderLanguageSelector />,
    [],
  );

  const contentArea = (
    <YStack
      flex={1}
      px="$5"
      // The transparent glass bar overlays the top of the content, so reserve
      // room for it via the shared inset (consistent across all glass screens).
      {...(useNativeHeader && { pt: glassTopInset })}
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
      {useNativeHeader ? (
        <Page.Header
          headerTitleAlign="center"
          headerTitle={headerTitle}
          headerLeft={
            isFirstScreen && headerBack !== false
              ? renderNativeHeaderLeft
              : undefined
          }
          headerRight={
            showLanguageSelector ? renderNativeHeaderRight : undefined
          }
        />
      ) : (
        <LayoutHeader>
          {headerBack !== false ? (
            <LayoutHeaderBack exit={headerBack === 'exit'} />
          ) : null}
          {headerTitle ? (
            <LayoutHeaderTitle>{headerTitle}</LayoutHeaderTitle>
          ) : null}
          {showLanguageSelector ? <LayoutHeaderLanguageSelector /> : null}
        </LayoutHeader>
      )}
      {scrollable ? (
        <Keyboard.AwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          bottomOffset={keyboardBottomOffset}
        >
          {contentArea}
        </Keyboard.AwareScrollView>
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
