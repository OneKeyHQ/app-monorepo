import { FC, memo, useCallback } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { Freeze } from 'react-freeze';

import {
  Box,
  DesktopDragZoneBox,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { useDesktopTopDragBarController } from '@onekeyhq/components/src/DesktopDragZoneBox/useDesktopTopDragBarController';

import WebContent from '../Content/WebContent.desktop';
import { useNotifyChanges } from '../Controller/useNotifyChanges';
import { useWebController } from '../Controller/useWebController';
import { webHandler } from '../explorerUtils';

import ControllerBarDesktop from './ControllerBarDesktop';
import TabBarDesktop from './TabBarDesktop';

const showExplorerBar = webHandler !== 'browser';

const WebContainer = memo(() => {
  useNotifyChanges();
  const { gotoSite, tabs, incomingUrl, clearIncomingUrl } = useWebController();

  useFocusEffect(
    useCallback(() => {
      if (incomingUrl) {
        gotoSite({ url: incomingUrl, isNewWindow: true });
        clearIncomingUrl();
      }
    }, [clearIncomingUrl, gotoSite, incomingUrl]),
  );

  return (
    <Box flex={1} zIndex={3}>
      {tabs.map((tab) => (
        <Freeze key={`${tab.id}-Freeze`} freeze={!tab.isCurrent}>
          <WebContent {...tab} />
        </Freeze>
      ))}
    </Box>
  );
});
WebContainer.displayName = 'WebContainer';

const ExplorerDesktop: FC = () => {
  useDesktopTopDragBarController({
    height: '0px',
  });
  const { top } = useSafeAreaInsets();

  return (
    <Box flex="1" zIndex={3}>
      {!!showExplorerBar && (
        <DesktopDragZoneBox>
          <Box mt={`${top ? top + 10 : 0}px`} bg="surface-subdued" zIndex={5}>
            <TabBarDesktop />
            <ControllerBarDesktop />
          </Box>
        </DesktopDragZoneBox>
      )}
      <WebContainer />
    </Box>
  );
};

export default ExplorerDesktop;
