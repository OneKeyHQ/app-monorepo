import { useCallback, useMemo, useState } from 'react';

import { Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import {
  EModalBulkSendRoutes,
  type IModalBulkSendParamList,
} from '@onekeyhq/shared/src/routes';
import {
  EIntervalMode,
  type IIntervalSettings,
} from '@onekeyhq/shared/types/bulkSend';

import {
  INTERVAL_SETTINGS_TITLE,
  IntervalSettingsContent,
} from '../../components/IntervalSettingsContent';
import { validateIntervalSettings } from '../../utils';

function BulkSendIntervalInput() {
  const navigation = useAppNavigation();

  const route = useAppRoute<
    IModalBulkSendParamList,
    EModalBulkSendRoutes.BulkSendIntervalInput
  >();

  const {
    networkId,
    accountId,
    unsignedTxs,
    approvesInfo,
    tokenInfo,
    transfersInfo,
    bulkSendMode,
    totalTokenAmount,
    totalFiatAmount,
    isInModal,
    isMaxMode,
    ataCount,
    intervalSettings: initialIntervalSettings,
    onConfirmIntervalSettings,
  } = route.params ?? {};

  const [intervalSettings, setIntervalSettings] = useState<IIntervalSettings>({
    mode: initialIntervalSettings?.mode ?? EIntervalMode.None,
    minSeconds: initialIntervalSettings?.minSeconds ?? '',
    maxSeconds: initialIntervalSettings?.maxSeconds ?? '',
  });
  const [showValidationError, setShowValidationError] = useState(false);

  const intervalError = useMemo(
    () => validateIntervalSettings(intervalSettings),
    [intervalSettings],
  );
  const shouldShowIntervalError = useMemo(
    () =>
      intervalSettings.mode === EIntervalMode.Specified &&
      (showValidationError ||
        intervalSettings.minSeconds !== '' ||
        intervalSettings.maxSeconds !== ''),
    [intervalSettings, showValidationError],
  );

  const handleConfirm = useCallback(() => {
    if (intervalError) {
      setShowValidationError(true);
      return;
    }
    onConfirmIntervalSettings?.(intervalSettings);
    navigation.push(EModalBulkSendRoutes.BulkSendReview, {
      networkId,
      accountId,
      unsignedTxs,
      approvesInfo,
      tokenInfo,
      transfersInfo,
      bulkSendMode,
      totalTokenAmount,
      totalFiatAmount,
      isInModal,
      isMaxMode,
      ataCount,
      intervalSettings,
    });
  }, [
    intervalError,
    navigation,
    networkId,
    accountId,
    unsignedTxs,
    approvesInfo,
    tokenInfo,
    transfersInfo,
    bulkSendMode,
    totalTokenAmount,
    totalFiatAmount,
    isInModal,
    isMaxMode,
    ataCount,
    intervalSettings,
    onConfirmIntervalSettings,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header
        headerTitle={INTERVAL_SETTINGS_TITLE}
      />
      <Page.Body px="$5" pb="$5">
        <IntervalSettingsContent
          value={intervalSettings}
          error={shouldShowIntervalError ? intervalError : undefined}
          onChange={setIntervalSettings}
        />
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onConfirmText={intl.formatMessage({
            id: ETranslations.wallet_bulk_send_btn_review,
          })}
          confirmButtonProps={{
            onPress: handleConfirm,
          }}
        />
      </Page.Footer>
    </Page>
  );
}

export default BulkSendIntervalInput;
