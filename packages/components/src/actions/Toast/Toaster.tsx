import { memo } from 'react';

import { Toaster as WebToaster } from 'burnt/web';
import { useMedia } from 'tamagui';

import { useThemeName } from '../../hooks';

function Toaster() {
  const media = useMedia();
  const themeName = useThemeName();

  return (
    <WebToaster
      {...(media.md
        ? {
            position: 'top-center',
          }
        : { position: 'bottom-right' })}
      closeButton
      theme={themeName}
    />
  );
}

export default memo(Toaster);
