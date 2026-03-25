import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalBulkSendRoutes,
  type IModalBulkSendParamList,
} from '@onekeyhq/shared/src/routes';
import {
  EIntervalMode,
  type IIntervalSettings,
} from '@onekeyhq/shared/types/bulkSend';

import { IntervalSettingsContent } from '../../components/IntervalSettingsContent';
import { validateIntervalSettings } from '../../utils';

function BulkSendIntervalInput() {
  const intl = useIntl();
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
  } = route.params ?? {};

  const [intervalSettings, setIntervalSettings] = useState<IIntervalSettings>({
    mode: EIntervalMode.None,
    minSeconds: '',
    maxSeconds: '',
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
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header
        headerTitle={intl.formatMessage({
          id: ETranslations.wallet_bulk_send_interval_title,
        })}
      />
      <Page.Body>
        <YStack px="$5" pt="$2">
          <IntervalSettingsContent
            value={intervalSettings}
            error={shouldShowIntervalError ? intervalError : undefined}
            onChange={setIntervalSettings}
          />
        </YStack>
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
