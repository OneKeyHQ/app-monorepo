import React, { FC, ReactNode } from 'react';

import { IBoxProps } from 'native-base';

import {
  Box,
  IconButton,
  PresenceTransition,
  Text,
} from '@onekeyhq/components';

type LayoutProps = {
  backButton?: boolean;
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
  fullHeight: false,
  scaleFade: false,
} as const;

const Layout: FC<LayoutProps> = ({
  backButton,
  secondaryContent,
  title,
  description,
  fullHeight,
  onPressBackButton,
  scaleFade,
  visible,
  children,
  ...rest
}) => (
  <>
    <PresenceTransition
      as={Box}
      visible={visible}
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
            onPress={onPressBackButton}
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
                <Text typography={{ sm: 'DisplayLarge', md: 'DisplayXLarge' }}>
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
            >
              {secondaryContent}
            </Box>
          ) : undefined}
        </Box>
      </Box>
    </PresenceTransition>
  </>
);

Layout.defaultProps = defaultProps;

export default Layout;
