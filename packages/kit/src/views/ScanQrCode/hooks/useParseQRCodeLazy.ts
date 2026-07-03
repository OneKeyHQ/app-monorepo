import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useClipboard } from '@onekeyhq/components';
import type {
  IBaseValue,
  IQRCodeHandlerParse,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';

import useAppNavigation from '../../../hooks/useAppNavigation';

export default function useParseQRCodeLazy() {
  const navigation = useAppNavigation();
  const clipboard = useClipboard();
  const intl = useIntl();

  const parse: IQRCodeHandlerParse<IBaseValue> = useCallback(
    async (value, params) => {
      const { parseQRCodeWithDeps } = await import('./useParseQRCode');
      return parseQRCodeWithDeps(value, params, {
        navigation,
        clipboard,
        intl,
      });
    },
    [navigation, clipboard, intl],
  );

  return useMemo(() => ({ parse }), [parse]);
}
