import React, { FC, ReactNode, useCallback, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { IBoxProps } from 'native-base';

import {
  Box,
  IconButton,
  PresenceTransition,
  ScrollView,
  Text,
  useSafeAreaInsets,
} from '@onekeyhq/components';

import { useOnboardingClose } from './hooks';

type LayoutProps = {
  backButton?: boolean;
  showCloseButton?: boolean;
  secondaryContent?: ReactNode;
  title?: string;
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
        pt: 4 + insets.top,
        pb: 4 + insets.bottom,
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
  description,
  fullHeight,
  onPressBackButton,
  scaleFade,
  visible,
  children,
  ...rest
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const isFocus = useIsFocused();
  const insets = useSafeAreaInsets();
  const { onboardingGoBack } = useOnboardingClose();

  const onClosePress = useCallback(() => {
    setIsClosing(true);
    // wait animation done
    setTimeout(onboardingGoBack, 200);
  }, [onboardingGoBack]);

  return (
    <LayoutScrollView>
      <PresenceTransition
        as={Box}
        visible={isClosing ? false : visible ?? isFocus}
        initial={{
          opacity: 0,
          translateX: scaleFade ? 0 : 24,
          scale: scaleFade ? 0.95 : 1,
        }}
        animate={{
          opacity: 1,
          translateX: 0,
          scale: 1,
          transition: { duration: 150 },
        }}
        flex={{ base: fullHeight ? 1 : undefined, sm: 'initial' }}
        w="full"
        maxW={800}
        mb={{ base: 'auto', sm: 0 }}
        {...rest}
      >
        {showCloseButton ? (
          <IconButton
            position="absolute"
            onPress={onClosePress}
            top={{ base: insets.top, sm: 1 }}
            right={{ base: 0, sm: 0 }}
            type="plain"
            size="lg"
            name="CloseOutline"
            circle
            zIndex={9999}
          />
        ) : null}
        <Box
          minH={640}
          flex={{ base: fullHeight ? 1 : undefined, sm: 'initial' }}
        >
          {backButton ? (
            <IconButton
              alignSelf="flex-start"
              ml={-2}
              name="ArrowLeftOutline"
              size="lg"
              type="plain"
              circle
              onPress={() =>
                onPressBackButton ? onPressBackButton() : onboardingGoBack()
              }
            />
          ) : undefined}

          <Box
            flex={{ base: fullHeight ? 1 : undefined, sm: 'initial' }}
            mt={{ base: 6, sm: 12 }}
            flexDirection={{ sm: 'row' }}
            justifyContent={fullHeight ? 'space-between' : undefined}
          >
            <Box
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

export default Layout;
