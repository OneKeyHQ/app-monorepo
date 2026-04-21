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
    >
      <SizableText size="$headingLg" textAlign="center">
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
  showLanguageSelector?: boolean;
  scrollable?: boolean;
  contentContainerProps?: IYStackProps;
  children: React.ReactNode;
}

export function OnboardingPage({
  headerBack = true,
  showLanguageSelector = true,
  scrollable = false,
  contentContainerProps,
  children,
  ...pageProps
}: IOnboardingPageProps) {
  const contentArea = (
    <YStack
      flex={1}
      px="$5"
      $gtMd={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <YStack
        w="100%"
        maxWidth={800}
        mx="auto"
        $md={{ flex: 1 }}
        $gtMd={{ minHeight: 522 }}
        {...contentContainerProps}
      >
        {children}
      </YStack>
    </YStack>
  );

  return (
    <Page {...pageProps}>
      <LayoutHeader>
        {headerBack !== false ? (
          <LayoutHeaderBack exit={headerBack === 'exit'} />
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

export function OnboardingPageFallback() {
  return <LayoutHeader />;
}
