import type { FC } from 'react';

import {
  Box,
  DesktopDragZoneBox,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { useDesktopTopDragBarController } from '@onekeyhq/components/src/DesktopDragZoneBox/useDesktopTopDragBarController';

import WebHomeContainer from '../Content/WebHomeContainer';
import { webHandler } from '../explorerUtils';

import ControllerBarDesktop from './ControllerBarDesktop';
import TabBarDesktop from './TabBarDesktop';
import TabbedWebContainer from './TabbedWebContainer';

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
        <WebHomeContainer />
      )}
    </Box>
  );
};

export default ExplorerDesktop;
