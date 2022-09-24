import { FC } from 'react';

import {
  Box,
  DesktopDragZoneBox,
  useSafeAreaInsets,
} from '@onekeyhq/components';

import TabBarDesktop from '../Controller/TabBarDesktop';
import WebControllerBarDesktop from '../Controller/WebControllerBarDesktop';

import type { ExplorerViewProps } from '..';

const Desktop: FC<ExplorerViewProps> = ({
  explorerContent,
  showExplorerBar,
  ...rest
}) => {
  const { top } = useSafeAreaInsets();

  return (
    <Box flex="1" zIndex={3}>
      {!!showExplorerBar && (
        <DesktopDragZoneBox>
          <Box mt={`${top}px`} bg="surface-subdued" zIndex={5}>
            <TabBarDesktop />
            <WebControllerBarDesktop {...rest} />
          </Box>
        </DesktopDragZoneBox>
      )}
      <Box flex={1} zIndex={3}>
        {explorerContent}
      </Box>
    </Box>
  );
};

export default Desktop;
