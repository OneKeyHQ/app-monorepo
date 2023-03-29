import type { FC, ReactNode } from 'react';

import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';

import { Box, useIsVerticalLayout, useTheme } from '@onekeyhq/components';

import DesktopDragZoneBox from '../../DesktopDragZoneBox';
import NavHeader from '../../NavHeader/NavHeader';

import type { MessageDescriptor } from 'react-intl';

type HeaderProps = {
  headerLeft?: () => ReactNode;
  headerRight: () => ReactNode;
  showOnDesktop?: boolean;
  i18nTitle?: MessageDescriptor['id'];
  testID?: string;
};

const DEFAULT_HEADER_VERTICAL = 57;
const DEFAULT_HEADER_HORIZONTAL = 65;

const Header: FC<HeaderProps> = ({
  headerLeft,
  headerRight,
  showOnDesktop,
  i18nTitle,
  testID,
}) => {
  const isVerticalLayout = useIsVerticalLayout();

  const headerHeight = isVerticalLayout
    ? DEFAULT_HEADER_VERTICAL
    : DEFAULT_HEADER_HORIZONTAL;
  const { themeVariant } = useTheme();

  const PrimaryComponent = (
    <DesktopDragZoneBox>
      <Box testID={testID}>
        <NavHeader
          style={{ height: headerHeight }}
          headerLeft={headerLeft}
          headerRight={headerRight}
          i18nTitle={i18nTitle}
        />
      </Box>
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
