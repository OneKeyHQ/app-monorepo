import { memo } from 'react';

import { Toaster as WebToaster } from 'sonner';
import { useMedia } from 'tamagui';

import { TOAST_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';

import { useThemeName } from '../../hooks/useStyle';

function Toaster() {
  const media = useMedia();
  const themeName = useThemeName();

  return (
    <WebToaster
      closeButton
      style={{
        zIndex: TOAST_Z_INDEX,
      }}
      visibleToasts={3}
      position={media.md ? 'top-center' : 'bottom-right'}
      theme={themeName}
    />
  );
}

export default memo(Toaster);
