import { FC } from 'react';

import {
  Box,
  DesktopDragZoneBox,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { useDesktopTopDragBarController } from '@onekeyhq/components/src/DesktopDragZoneBox/useDesktopTopDragBarController';

import {
  SingleWebContainer,
  TabbedWebContainer,
} from '../Content/WebContainer';
import { webHandler } from '../explorerUtils';

import ControllerBarDesktop from './ControllerBarDesktop';
import TabBarDesktop from './TabBarDesktop';

const showExplorerBar = webHandler !== 'browser';

const ExplorerDesktop: FC = () => {
  useDesktopTopDragBarController({
    height: '0px',
  });
  const { top } = useSafeAreaInsets();

  return (
    <Box flex="1" zIndex={3}>
      {showExplorerBar && (
        <DesktopDragZoneBox>
          <Box mt={`${top ? top + 10 : 0}px`} bg="surface-subdued" zIndex={5}>
            <TabBarDesktop />
            <ControllerBarDesktop />
          </Box>
        </DesktopDragZoneBox>
      )}
      {webHandler === 'tabbedWebview' ? (
        <TabbedWebContainer />
      ) : (
        <SingleWebContainer />
      )}
    </Box>
  );
};

export default ExplorerDesktop;
