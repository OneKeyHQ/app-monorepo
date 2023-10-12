import { memo } from 'react';

import { Toaster as WebToaster } from 'burnt/web';
import { useMedia } from 'tamagui';

import useProviderValue from '../Provider/hooks/useProviderValue';

function Toaster() {
  const media = useMedia();
  const { themeVariant } = useProviderValue();

  return (
    <WebToaster
      {...(media.md
        ? {
            position: 'top-center',
          }
        : { position: 'bottom-right' })}
      closeButton
      theme={themeVariant}
    />
  );
}

export default memo(Toaster);
