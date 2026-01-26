import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IXStackProps, IYStackProps } from '@onekeyhq/components';
import {
  Button,
  IconButton,
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

// Constants for performance optimization
const DESKTOP_DRAGGABLE_STYLE = {
  WebkitAppRegion: 'drag',
} as any;

const SCROLL_VIEW_CONTENT_STYLE = {
  px: '$5',
  $gtMd: {
    px: '$10',
  },
};

const OnboardingLayoutBack = memo(({ exit }: { exit?: boolean }) => {
  const navigation = useAppNavigation();

  const icon = exit ? 'CrossedLargeOutline' : 'ArrowLeftOutline';

  const handleBack = useCallback(() => {
    navigation.pop();
  }, [navigation]);

  return (
    <IconButton
      size="medium"
      icon={icon}
      variant="tertiary"
      onPress={handleBack}
      zIndex={1}
    />
  );
});
OnboardingLayoutBack.displayName = 'OnboardingLayoutBack';

const OnboardingLayoutLanguageSelector = memo(() => {
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
    <YStack ml="auto">
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
OnboardingLayoutLanguageSelector.displayName =
  'OnboardingLayoutLanguageSelector';

const OnboardingLayoutTitle = memo(
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
OnboardingLayoutTitle.displayName = 'OnboardingLayoutTitle';

const OnboardingLayoutHeader = memo(
  ({
    showBackButton = true,
    showLanguageSelector = true,
    title,
    children,
    ...rest
  }: {
    showBackButton?: boolean;
    showLanguageSelector?: boolean;
    title?: string;
    children?: React.ReactNode;
  } & IXStackProps) => (
    <XStack
      h="$6"
      px="$5"
      $gtMd={{
        px: 56,
        borderWidth: 0,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderStyle: 'solid',
        borderColor: '$neutral4',
        '$platform-web': {
          borderStyle: 'dashed',
        },
      }}
      alignItems="center"
      {...rest}
    >
      {showBackButton ? <OnboardingLayoutBack /> : null}
      {title ? <OnboardingLayoutTitle>{title}</OnboardingLayoutTitle> : null}
      {children}
      {showLanguageSelector ? <OnboardingLayoutLanguageSelector /> : null}
    </XStack>
  ),
);
OnboardingLayoutHeader.displayName = 'OnboardingLayoutHeader';

const OnboardingLayoutConstrainedContent = memo(
  ({ children, ...rest }: { children: React.ReactNode } & IYStackProps) => {
    return (
      <YStack
        w="100%"
        alignSelf="center"
        $gtMd={{
          py: '$10',
          maxWidth: 400,
        }}
        gap="$5"
        {...(!platformEnv.isNativeIOS && {
          animation: 'quick',
          animateOnly: ['opacity', 'transform'],
          enterStyle: {
            opacity: 0,
            x: 24,
            filter: 'blur(4px)',
          },
        })}
        {...rest}
      >
        {children}
      </YStack>
    );
  },
);
OnboardingLayoutConstrainedContent.displayName =
  'OnboardingLayoutConstrainedContent';

const OnboardingLayoutBody = memo(
  ({
    children,
    scrollable = true,
    constrained = true,
    ...rest
  }: {
    children?: React.ReactNode;
    scrollable?: boolean;
    constrained?: boolean;
  } & IYStackProps) => {
    const content = constrained ? (
      <OnboardingLayoutConstrainedContent>
        {children}
      </OnboardingLayoutConstrainedContent>
    ) : (
      children
    );

    const pxProps = useMemo(
      () => (!scrollable ? { px: '$5' } : {}),
      [scrollable],
    );

    return (
      <YStack
        flex={1}
        minHeight={0}
        overflow="hidden"
        $gtMd={{
          borderWidth: 0,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderStyle: 'solid',
          borderColor: '$neutral4',
          '$platform-web': {
            borderStyle: 'dashed',
          },
          ...(!scrollable && {
            px: '$10',
          }),
        }}
        {...pxProps}
        {...rest}
      >
        {scrollable ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={SCROLL_VIEW_CONTENT_STYLE}
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </YStack>
    );
  },
);
OnboardingLayoutBody.displayName = 'OnboardingLayoutBody';

const OnboardingLayoutFooter = memo(
  ({ children }: { children?: React.ReactNode }) => {
    return (
      <XStack
        px="$5"
        $gtMd={{
          px: '$10',
          borderWidth: 0,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderStyle: 'solid',
          borderColor: '$neutral4',
          '$platform-web': {
            borderStyle: 'dashed',
          },
        }}
        minHeight="$6"
        justifyContent="center"
        alignItems="center"
      >
        {children}
      </XStack>
    );
  },
);
OnboardingLayoutFooter.displayName = 'OnboardingLayoutFooter';

const OnboardingLayoutRoot = memo(
  ({ children }: { children: React.ReactNode }) => {
    const { top, bottom } = useSafeAreaInsets();

    return (
      <YStack
        h="100%"
        $platform-web={{
          height: '100vh',
        }}
        alignItems="center"
        justifyContent="center"
        bg="$bgSubdued"
        $gtMd={{
          p: '$10',
        }}
      >
        {/* Draggable area for desktop window */}
        {platformEnv.isDesktop ? (
          <YStack
            position="absolute"
            top={0}
            left={0}
            right={0}
            h={80}
            zIndex={9999}
            style={DESKTOP_DRAGGABLE_STYLE}
          />
        ) : null}
        <YStack
          h="100%"
          w="100%"
          px="$5"
          bg="$bgApp"
          $theme-dark={{
            outlineWidth: 1,
            outlineColor: '$neutral3',
            outlineStyle: 'solid',
          }}
          $gtMd={{
            px: '$10',
            maxWidth: 1440,
            maxHeight: 1024,
            borderRadius: 40,
            borderCurve: 'continuous',
            '$platform-web': {
              boxShadow:
                '0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            },
            '$platform-ios': {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 1,
            },
          }}
        >
          <YStack
            py="$10"
            h="100%"
            $gtMd={{
              borderWidth: 0,
              borderLeftWidth: 1,
              borderRightWidth: 1,
              borderStyle: 'solid',
              borderColor: '$neutral4',
              '$platform-web': {
                borderStyle: 'dashed',
              },
            }}
            $platform-native={{
              pt: top + 10,
              pb: bottom + 10,
            }}
          >
            <YStack
              h="100%"
              gap="$5"
              mx="$-5"
              $gtMd={{
                mx: '$-10',
                gap: '$10',
              }}
            >
              {children}
            </YStack>
          </YStack>
        </YStack>
      </YStack>
    );
  },
);
OnboardingLayoutRoot.displayName = 'OnboardingLayoutRoot';

export const OnboardingLayoutFallback = () => {
  return (
    <OnboardingLayoutRoot>
      <OnboardingLayoutHeader
        showBackButton={false}
        showLanguageSelector={false}
      />
      <OnboardingLayoutBody />
    </OnboardingLayoutRoot>
  );
};

export const OnboardingLayout = Object.assign(OnboardingLayoutRoot, {
  Header: OnboardingLayoutHeader,
  Body: OnboardingLayoutBody,
  ConstrainedContent: OnboardingLayoutConstrainedContent,
  Footer: OnboardingLayoutFooter,
  Language: OnboardingLayoutLanguageSelector,
  Back: OnboardingLayoutBack,
  Title: OnboardingLayoutTitle,
});
