import { ComponentType } from 'react';

import RootSiblings from 'react-native-root-siblings';

interface WithOnClose {
  onClose: (...args: any[]) => void;
}

export function showOverlayFactory<T extends WithOnClose = WithOnClose>(
  Overlay: ComponentType<T>,
) {
  let modal: RootSiblings | null;
  return (props: Omit<T, 'onClose'>) => {
    if (modal) {
      return;
    }
    return new Promise((resolve) => {
      const element = (
        <Overlay
          {...(props as T)}
          onClose={(ret: Parameters<T['onClose']>) => {
            if (modal) {
              modal.destroy();
              modal = null;
            }
            resolve(ret);
          }}
        />
      );
      modal = new RootSiblings(element);
    });
  };
}
