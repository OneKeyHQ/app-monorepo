import { memo } from 'react';

import { createPortal } from 'react-dom';
import { Toaster as WebToaster } from 'sonner';
import { useMedia } from 'tamagui';

import { TOAST_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';

import { useThemeName } from '../../hooks/useStyle';
import { Stack } from '../../primitives';

function Toaster() {
  const media = useMedia();
  const themeName = useThemeName();

  return (
    <Stack
      testID="onekey-toast-messages"
      zIndex={TOAST_Z_INDEX}
      // https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events#bounding-box
      // allow svg button elements to be clickable
      pointerEvents={'bounding-box' as any}
    >
      <WebToaster
        closeButton
        style={{
          zIndex: TOAST_Z_INDEX,
        }}
        visibleToasts={3}
        position={media.md ? 'top-center' : 'bottom-right'}
        theme={themeName}
      />
    </Stack>
  );
}

function BodyPortal() {
  return createPortal(<Toaster />, document.body);
}

export default memo(BodyPortal);
