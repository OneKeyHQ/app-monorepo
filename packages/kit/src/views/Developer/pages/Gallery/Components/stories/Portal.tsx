/* eslint-disable react/no-unstable-nested-components */

import { useEffect, useMemo, useState } from 'react';

import { Button, Portal, SizableText, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

// Overlays render in `OverlayView`; Portal only moves content into an in-page
// slot (here the suggestion list slot, as the phrase input does).
const ActiveDemo = () => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setCount((i) => i + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const content = useMemo(() => <Button>Rendered through the slot</Button>, []);
  return (
    <YStack gap="$3">
      <SizableText>{`Ticks: ${count}`}</SizableText>
      <Portal.Body container={Portal.Constant.SUGGESTION_LIST}>
        {content}
      </Portal.Body>
      <SizableText>Slot:</SizableText>
      <Portal.Container name={Portal.Constant.SUGGESTION_LIST} />
    </YStack>
  );
};

const PortalGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="Portal"
    elements={[
      {
        title: '',
        element: <ActiveDemo />,
      },
    ]}
  />
);

export default PortalGallery;
