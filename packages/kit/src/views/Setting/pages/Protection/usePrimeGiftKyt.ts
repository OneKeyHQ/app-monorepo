import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  usePrimePersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { getErrorMessage } from '../../../Prime/primeSubscriptionPurchaseSuccess';

import { useKytIntroDialogPresenter } from './useKytIntroDialogPresenter';

export function usePrimeGiftKyt({
  expectedOneKeyUserId,
}: {
  expectedOneKeyUserId: string;
}) {
  const intl = useIntl();
  const [{ onekeyUserId }] = usePrimePersistAtom();
  const [{ receiveRiskMonitoringMap }] = useSettingsPersistAtom();
  const showDialog = useKytIntroDialogPresenter();
  const [isLoading, setIsLoading] = useState(false);
  const [confirmedEnabledUserId, setConfirmedEnabledUserId] = useState<
    string | undefined
  >();
  const activeAccountRef = useRef({ onekeyUserId, expectedOneKeyUserId });
  activeAccountRef.current = { onekeyUserId, expectedOneKeyUserId };
  const isMountedRef = useRef(true);
  const dialogOpenRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const isEnabled =
    !!expectedOneKeyUserId &&
    (receiveRiskMonitoringMap?.[expectedOneKeyUserId] ??
      confirmedEnabledUserId === expectedOneKeyUserId);

  const open = useCallback(async () => {
    const targetUserId = expectedOneKeyUserId;
    const isActive = () =>
      isMountedRef.current &&
      !!targetUserId &&
      activeAccountRef.current.onekeyUserId === targetUserId &&
      activeAccountRef.current.expectedOneKeyUserId === targetUserId;
    if (!isActive() || isEnabled || dialogOpenRef.current) {
      return;
    }
    dialogOpenRef.current = true;
    setIsLoading(true);
    try {
      const enabled = await backgroundApiProxy.serviceSetting.getKytEnabled({
        onekeyUserId: targetUserId,
      });
      if (!isActive() || enabled) {
        if (isActive() && enabled) {
          setConfirmedEnabledUserId(targetUserId);
        }
        dialogOpenRef.current = false;
        return;
      }
      // Explicit requests may reopen a dismissed intro; only automatic prompts
      // consult the persisted "shown" gate.
      showDialog({
        entryPoint: 'primeGiftSuccess',
        targetUserId,
        stayOnCurrentPage: true,
        isActive,
        onClose: () => {
          dialogOpenRef.current = false;
        },
      });
      void backgroundApiProxy.serviceSetting
        .completeKytIntroClaim({ onekeyUserId: targetUserId })
        .catch((error) => {
          defaultLogger.prime.usage.primeReceiveKytIntroFlowFailed({
            stage: 'claimComplete',
            errorMessage: getErrorMessage(error),
          });
        });
    } catch (error) {
      dialogOpenRef.current = false;
      if (isActive()) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          }),
        });
      }
      defaultLogger.prime.usage.primeReceiveKytIntroFlowFailed({
        stage: 'eligibility',
        errorMessage: getErrorMessage(error),
      });
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [expectedOneKeyUserId, intl, isEnabled, showDialog]);

  return { isEnabled, isLoading, open };
}
