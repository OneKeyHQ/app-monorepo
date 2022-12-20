import type { FC, ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';

import {
  Box,
  IconButton,
  PresenceTransition,
  ScrollView,
  Text,
  Typography,
  useSafeAreaInsets,
  useUserDevice,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useOnboardingClose } from './hooks';
import {
  OnboardingContextProvider,
  useOnboardingContext,
} from './OnboardingContext';

import type { IBoxProps } from 'native-base';

type LayoutProps = {
  disableAnimation?: boolean;
  backButton?: boolean;
  showCloseButton?: boolean;
  secondaryContent?: ReactNode;
  title?: string;
  subTitle?: string;
  description?: string;
  visible?: boolean;
  onPressBackButton?: () => void;
  /*
    100% height on small screen, useful for space between layout
  */
  fullHeight?: boolean;
  scaleFade?: boolean;
} & IBoxProps;

const defaultProps = {
  backButton: true,
  showCloseButton: false,
  fullHeight: false,
  scaleFade: false,
} as const;

function LayoutScrollView({ children }: { children: any }) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      flex={1}
      bounces={false}
      _contentContainerStyle={{
        // flex: {
        //   base:
        //     isShowRecoveryPhraseView || isRecoveryPhraseView ? 1 : undefined,
        //   sm: 1,
        // },
        minHeight: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        px: 6,
        pt: `${16 + insets.top}px`,
        pb: `${16 + insets.bottom}px`,
        bgColor: 'background-default',
      }}
    >
      {children}
    </ScrollView>
  );
}

const Layout: FC<LayoutProps> = ({
  backButton,
  showCloseButton,
  secondaryContent,
  title,
  subTitle,
  description,
  fullHeight,
  onPressBackButton,
  scaleFade,
  visible,
  children,
  disableAnimation,
  ...rest
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const isFocus = useIsFocused();
  const insets = useSafeAreaInsets();
  const { onboardingGoBack } = useOnboardingClose();
  const context = useOnboardingContext();
  const isSmallHeight = useUserDevice().screenHeight <= 667;

  const onClosePress = useCallback(() => {
    setIsClosing(true);
    // wait animation done
    setTimeout(onboardingGoBack, 200);
  }, [onboardingGoBack]);

  const finalVisible = useMemo(() => {
    if (platformEnv.isNative) {
      return true;
    }
    // closing animation fade out
    if (isClosing) {
      return false;
    }
    return visible ?? context?.visible ?? isFocus;
  }, [context?.visible, isClosing, isFocus, visible]);

  return (
    <LayoutScrollView>
      {showCloseButton ? (
        <IconButton
          position="absolute"
          onPress={onClosePress}
          top={{ base: `${insets.top + 16}px`, sm: 8 }}
          right={{ base: 4, sm: 8 }}
          type="plain"
          size="lg"
          name="XMarkOutline"
          circle
          zIndex={9999}
        />
      ) : null}
      <PresenceTransition
        as={Box}
        visible={finalVisible}
        initial={
          disableAnimation
            ? undefined
            : {
                opacity: 0,
                translateX: scaleFade ? 0 : 24,
                scale: scaleFade ? 0.95 : 1,
              }
        }
        animate={
          disableAnimation
            ? undefined
            : {
                opacity: 1,
                translateX: 0,
                scale: 1,
                transition: { duration: 150 },
              }
        }
        flexGrow={{ base: fullHeight ? 1 : undefined, sm: 0 }}
        w="full"
        maxW={800}
        mb={{ base: 'auto', sm: 0 }}
        {...rest}
      >
        <Box
          minH={isSmallHeight ? '560px' : '640px'}
          flexGrow={{ base: fullHeight ? 1 : undefined, sm: 0 }}
        >
          {backButton ? (
            <IconButton
              alignSelf="flex-start"
              ml={-2}
              name="ArrowLeftOutline"
              size="lg"
              type="plain"
              zIndex={9999}
              circle
              onPress={() =>
                onPressBackButton ? onPressBackButton() : onboardingGoBack()
              }
            />
          ) : undefined}

          <Box
            flexGrow={{ base: fullHeight ? 1 : undefined, sm: 0 }}
            mt={{ base: 6, sm: 12 }}
            flexDirection={{ sm: 'row' }}
            justifyContent={fullHeight ? 'space-between' : undefined}
          >
            <Box
              flex={fullHeight && !secondaryContent ? 1 : undefined}
              flexShrink={fullHeight ? 0 : undefined}
              w={{ sm: secondaryContent ? 400 : 'full' }}
            >
              {title ? (
                <Box mb={{ base: 6, sm: 12 }}>
                  <Text
                    typography={{ sm: 'DisplayLarge', md: 'DisplayXLarge' }}
                  >
                    {title}
                  </Text>

                  {subTitle ? (
                    <Typography.Body1 textAlign="left" color="text-subdued">
                      {subTitle}
                    </Typography.Body1>
                  ) : undefined}

                  {description ? (
                    <Text
                      typography={{ sm: 'DisplayLarge', md: 'DisplayXLarge' }}
                      color="text-subdued"
                    >
                      {description}
                    </Text>
                  ) : undefined}
                </Box>
              ) : undefined}
              {children}
            </Box>
            {secondaryContent ? (
              <Box
                flex={{ base: fullHeight ? 1 : undefined, sm: 1 }}
                mt={{ base: 6, sm: 0 }}
                ml={{ sm: 20 }}
                pl={{ sm: 8 }}
                borderLeftWidth={{ sm: 3 }}
                borderLeftColor="divider"
                testID="ConnectWallet-SecondaryContent-Container"
              >
                {secondaryContent}
              </Box>
            ) : undefined}
          </Box>
        </Box>
      </PresenceTransition>
    </LayoutScrollView>
  );
};

Layout.defaultProps = defaultProps;

function LayoutContainer(props: LayoutProps) {
  return (
    <OnboardingContextProvider>
      <Layout {...props} />
    </OnboardingContextProvider>
  );
}

export default LayoutContainer;
