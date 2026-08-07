import { useMemo } from 'react';

import type { IDevelopmentDesktopWebContentProps } from './developmentDesktopWebContentTypes';

const noOp = () => undefined;

export function useDevelopmentDesktopWebContent(
  _props: IDevelopmentDesktopWebContentProps & { id: string },
) {
  return useMemo(
    () => ({
      didRedirectNavigation: undefined,
      didStartNavigation: noOp,
      domReady: noOp,
      isCurrent: () => true,
      navigationSettled: noOp,
      webViewKey: undefined,
      webViewProps: {},
    }),
    [],
  );
}
