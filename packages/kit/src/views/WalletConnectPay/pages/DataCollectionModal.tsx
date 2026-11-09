import { useCallback, useMemo, useRef } from 'react';

import { useRoute } from '@react-navigation/core';

import { Page } from '@onekeyhq/components';
import type {
  EModalWalletConnectPayRoutes,
  IModalWalletConnectPayParamList,
} from '@onekeyhq/shared/src/routes';
import { isWcPayTrustedUrl } from '@onekeyhq/shared/src/walletConnect/payConstant';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { DataCollectionView } from '../components/DataCollectionView';

import type { RouteProp } from '@react-navigation/core';

export function DataCollectionModal() {
  const route =
    useRoute<
      RouteProp<
        IModalWalletConnectPayParamList,
        EModalWalletConnectPayRoutes.DataCollection
      >
    >();
  const { collectData, onComplete, onError, onCancel } = route.params;
  const navigation = useAppNavigation();
  const themeVariant = useThemeVariant();
  const finishedRef = useRef(false);

  const formUrl = useMemo(() => {
    const base = collectData.url ?? '';
    // defense in depth: the caller already validated the host, but never
    // load an untrusted URL into the form container
    if (!base || !isWcPayTrustedUrl(base)) {
      return '';
    }
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}theme=${
      themeVariant === 'dark' ? 'dark' : 'light'
    }`;
  }, [collectData.url, themeVariant]);

  const handleComplete = useCallback(() => {
    finishedRef.current = true;
    navigation.pop();
    onComplete();
  }, [navigation, onComplete]);

  const handleError = useCallback(
    (error: string) => {
      finishedRef.current = true;
      navigation.pop();
      onError(error);
    },
    [navigation, onError],
  );

  return (
    <Page
      onClose={() => {
        // closing mid-form ends the flow so it does not hang; it is a
        // user-intent cancellation, not an error
        if (!finishedRef.current) {
          onCancel();
        }
      }}
    >
      <Page.Header title="WalletConnect Pay" />
      <Page.Body>
        {formUrl ? (
          <DataCollectionView
            url={formUrl}
            onComplete={handleComplete}
            onError={handleError}
          />
        ) : null}
      </Page.Body>
    </Page>
  );
}
