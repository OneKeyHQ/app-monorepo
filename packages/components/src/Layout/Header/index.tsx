import type { FC, ReactNode } from 'react';

import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';

import Box from '../../Box';
import DesktopDragZoneBox from '../../DesktopDragZoneBox';
import HStack from '../../HStack';
import {
  useIsVerticalLayout,
  useSafeAreaInsets,
  useTheme,
  useThemeValue,
  useUserDevice,
} from '../../Provider/hooks';

type HeaderProps = {
  headerLeft: () => ReactNode;
  headerRight: () => ReactNode;
  showOnDesktop?: boolean;
};

const DEFAULT_HEADER_VERTICAL = 57;
const DEFAULT_HEADER_HORIZONTAL = 65;

const Header: FC<HeaderProps> = ({
  headerLeft,
  headerRight,
  showOnDesktop,
}) => {
  const insets = useSafeAreaInsets();
  const { size } = useUserDevice();
  const isHorizontal = ['NORMAL', 'LARGE', 'XLARGE'].includes(size);

  const headerHeight = isHorizontal
    ? DEFAULT_HEADER_HORIZONTAL
    : DEFAULT_HEADER_VERTICAL;

  const headerLeftNode = headerLeft?.();
  const { themeVariant } = useTheme();
  const temporaryBg = useThemeValue('background-default');
  const isVerticalLayout = useIsVerticalLayout();

  const PrimaryComponent = (
    <DesktopDragZoneBox>
      <HStack
        testID="AppLayoutGlobalNavigationHeader"
        height={`${headerHeight + insets.top}px`}
        pt={`${insets.top}px`}
        alignItems="center"
        justifyContent={isHorizontal ? 'flex-end' : 'space-between'}
        px={{ base: 4, md: 8 }}
        style={{ backgroundColor: temporaryBg }} // TODO remove this line after add ScrollUp event
      >
        {headerLeftNode ? (
          <Box
            flex={isHorizontal ? undefined : 1}
            justifyContent="center"
            h="full"
            pl={{ md: 2 }}
            pr={{ md: 4 }}
            flexShrink={0}
          >
            {headerLeftNode}
          </Box>
        ) : null}

        {/* {isHorizontal && (
      <HStack alignItems="center" flex={1} pl={8}>
        <Typography.Heading>Home</Typography.Heading>
      </HStack>
    )} */}
        <HStack
          flex={isHorizontal ? undefined : 1}
          alignItems="center"
          justifyContent="flex-end"
        >
          {headerRight()}
        </HStack>
      </HStack>
    </DesktopDragZoneBox>
  );

  if (isVerticalLayout || showOnDesktop)
    return (
      <>
        {Platform.OS === 'web' ? (
          PrimaryComponent
        ) : (
          <BlurView
            intensity={0} // TODO: change the intensity from 0 to 80 while scrolling up
            tint={
              // eslint-disable-next-line no-nested-ternary
              themeVariant === 'light'
                ? 'light'
                : themeVariant === 'dark'
                ? 'dark'
                : 'default'
            }
          >
            {PrimaryComponent}
          </BlurView>
        )}
      </>
    );
  return null;
};

export default Header;
