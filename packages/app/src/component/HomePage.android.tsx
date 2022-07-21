import { FC, ReactNode, useMemo } from 'react';

import { requireNativeComponent, useWindowDimensions } from 'react-native';

import { useIsVerticalLayout } from '@onekeyhq/components';
import {
  FIXED_HORIZONTAL_HEDER_HEIGHT,
  FIXED_VERTICAL_HEADER_HEIGHT,
} from '@onekeyhq/kit/src/views/Wallet/AccountInfo';

const RNCHomePage = requireNativeComponent('RNCHomePage');

export type HomePageProps = {
  hardHeight: number;
  hardView?: () => ReactNode | undefined;
  tabView?: () => ReactNode;
  contentView: () => ReactNode;
};

// TODO: Compatible with the pad
const HomePage: FC<HomePageProps> = ({ hardView, contentView, ...props }) => {
  const dimensions = useWindowDimensions();
  const isVerticalLayout = useIsVerticalLayout();

  const height = useMemo(() => {
    let harderHeight = FIXED_HORIZONTAL_HEDER_HEIGHT;
    if (isVerticalLayout) {
      harderHeight = FIXED_VERTICAL_HEADER_HEIGHT - 129;
    }

    return dimensions.height + harderHeight;
  }, [dimensions.height, isVerticalLayout]);

  return (
    <RNCHomePage
      {...props}
      // @ts-expect-error
      style={{
        height,
      }}
    >
      {hardView?.()}
      {contentView()}
    </RNCHomePage>
  );
};

export default HomePage;
