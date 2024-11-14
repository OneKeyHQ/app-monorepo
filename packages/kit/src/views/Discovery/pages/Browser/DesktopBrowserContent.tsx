import { memo, useCallback } from 'react';

import { Freeze } from 'react-freeze';

import {
  IconButton,
  Input,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { useBrowserHistoryAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import WebContent from '../../components/WebContent/WebContent';
import { useWebTabDataById } from '../../hooks/useWebTabs';

function BasicFind({ id }: { id: string }) {
  const handleFindPrev = useCallback(() => {
    console.log('handleFindPrev');
  }, []);
  const handleFindNext = useCallback(() => {}, []);

  const handleClose = useCallback(() => {}, []);
  return (
    <XStack position="absolute" left="50%" top={0} zIndex={100_000}>
      <XStack
        bg="$bgApp"
        left="-50%"
        py="$2.5"
        px="$4"
        ai="center"
        borderRadius="$3"
        borderWidth="$px"
        borderColor="$border"
      >
        <Input
          containerProps={{
            borderWidth: 0,
            px: 0,
          }}
          InputComponentStyle={{
            px: 0,
          }}
        />
        <SizableText>0/0</SizableText>
        <Stack width="$px" height="100%" bg="$borderStrong" mx="$4" />
        <XStack gap="$2">
          <IconButton
            variant="tertiary"
            icon="ChevronTopSmallOutline"
            size="small"
            onPress={handleFindPrev}
          />
          <IconButton
            variant="tertiary"
            icon="ChevronDownSmallOutline"
            size="small"
            onPress={handleFindNext}
          />
          <IconButton
            variant="tertiary"
            icon="CrossedSmallSolid"
            size="small"
            onPress={handleClose}
          />
        </XStack>
      </XStack>
    </XStack>
  );
}

const Find = memo(BasicFind);

function DesktopBrowserContent({
  id,
  activeTabId,
}: {
  id: string;
  activeTabId: string | null;
}) {
  const { tab } = useWebTabDataById(id);
  const isActive = activeTabId === id;
  const { addBrowserHistory } = useBrowserHistoryAction().current;
  return (
    <Freeze key={id} freeze={!isActive}>
      {platformEnv.isDesktop ? <Find id={id} /> : null}
      <WebContent
        id={id}
        url={tab.url}
        isCurrent={isActive}
        addBrowserHistory={(siteInfo) => addBrowserHistory(siteInfo)}
      />
    </Freeze>
  );
}

export default DesktopBrowserContent;
