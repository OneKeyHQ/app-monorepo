import type { ReactElement } from 'react';
import { createContext } from 'react';

import RootSiblings from 'react-native-root-siblings';

export const OverlayContext = createContext({
  closeOverlay: () => {},
});
export function showOverlay(
  renderOverlay: (closeOverlay: () => void) => ReactElement,
) {
  let modal: RootSiblings | null;
  const closeOverlay = () => {
    modal?.destroy();
    modal = null;
  };
  setTimeout(() => {
    modal = new RootSiblings(
      (
        <OverlayContext.Provider value={{ closeOverlay }}>
          {renderOverlay(closeOverlay)}
        </OverlayContext.Provider>
      ),
    );
  });
  return closeOverlay;
}
