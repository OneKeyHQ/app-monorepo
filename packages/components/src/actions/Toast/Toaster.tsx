import { memo } from 'react';

import { Toaster as WebToaster } from 'sonner';
import { useMedia } from 'tamagui';

import { useThemeName } from '../../hooks/useStyle';

function Toaster() {
  const media = useMedia();
  const themeName = useThemeName();

  return (
    <WebToaster
      position={media.md ? 'top-center' : 'bottom-right'}
      closeButton
      theme={themeName}
    />
  );
}

export default memo(Toaster);
