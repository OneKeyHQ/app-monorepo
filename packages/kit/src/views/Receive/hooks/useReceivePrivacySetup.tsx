import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { showPrivacyChainSlotsFullDialog } from '@onekeyhq/kit/src/utils/privacyChainSlotsFullDialog';
import {
  getBirthdayInputError,
  readEnableBirthday,
} from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/LocalWalletRepairControls';
import {
  PrivacyEnableContent,
  createPrivacyEnableForm,
} from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/PrivacyEnableContent';
import { isLocalWalletSlotsFullError } from '@onekeyhq/kit-bg/src/vaults/localWallet/userFacingError';
import type { IVaultSettings } from '@onekeyhq/kit-bg/src/vaults/types';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';

export function useReceivePrivacySetup({
  networkId,
  accountId,
  settings,
  onEnabled,
  onOpenSettings,
}: {
  networkId: string;
  accountId: string | undefined;
  settings: IVaultSettings['localWallet'];
  onEnabled: () => void;
  onOpenSettings: () => void;
}) {
  const intl = useIntl();
  const [busy, setBusy] = useState(false);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const activeRequestRef = useRef<number | undefined>(undefined);
  const scope = `${networkId}:${accountId ?? ''}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  useEffect(() => {
    activeRequestRef.current = undefined;
    setBusy(false);
  }, [scope]);

  const open = useCallback(
    async (action?: 'resumeChain') => {
      if (!accountId || !settings || activeRequestRef.current !== undefined)
        return;
      requestRef.current += 1;
      const request = requestRef.current;
      activeRequestRef.current = request;
      const isActive = () =>
        mountedRef.current &&
        scopeRef.current === scope &&
        activeRequestRef.current === request;
      const finish = () => {
        if (!isActive()) return;
        activeRequestRef.current = undefined;
        setBusy(false);
      };
      const params = { networkId, accountId };
      setBusy(true);
      const showError = (error: unknown) => {
        if (
          !isActive() ||
          errorToastUtils.isUserCancelStyleError(error) ||
          errorToastUtils.wasAutoToastShown(error)
        )
          return;
        if (isLocalWalletSlotsFullError(error)) {
          showPrivacyChainSlotsFullDialog({ intl, onOpenSettings });
        } else {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_an_error_occurred,
            }),
          });
        }
      };
      try {
        const [support, state] = await Promise.all([
          backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountSupport(
            params,
          ),
          backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountState(
            params,
          ),
        ]);
        if (!isActive()) return;
        if (support !== 'supported' || state.privacyDisabled) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_not_available,
            }),
          });
          finish();
          return;
        }
        const enable = async (birthday: {
          birthdayHeight?: number;
          birthdayTimestamp?: number;
        }) => {
          if (!isActive()) return;
          await backgroundApiProxy.servicePrivacyChain.enableLocalWalletAccount(
            {
              ...params,
              ...birthday,
            },
          );
          if (isActive()) onEnabled();
        };
        if (state.pendingOperation || (state.enabled && !state.paused)) {
          if (action === 'resumeChain' && !state.pendingOperation) {
            await backgroundApiProxy.servicePrivacyChain.startForegroundBoost({
              ...params,
              trigger: 'manual-sync',
            });
          }
          if (isActive()) onEnabled();
          finish();
          return;
        }
        if (state.paused || !settings.accountSetup.requiresBirthday) {
          await enable({});
          finish();
          return;
        }
        await backgroundApiProxy.servicePrivacyChain.assertLocalWalletAccountAdmission(
          params,
        );
        if (!isActive()) return;
        const twinBirthday =
          await backgroundApiProxy.servicePrivacyChain.getLocalWalletTwinBirthday(
            params,
          );
        if (!isActive()) return;
        if (twinBirthday) {
          await enable(twinBirthday);
          finish();
          return;
        }
        const earliestBirthday = settings.accountSetup.earliestBirthday;
        const formRef = createPrivacyEnableForm({ earliestBirthday });
        Dialog.show({
          showCancelButton: true,
          showConfirmButton: true,
          title: intl.formatMessage({
            id: ETranslationsMock.privacy_enable_account__title,
            defaultMessage: ETranslationsMock.privacy_enable_account__title,
          }),
          renderContent: (
            <PrivacyEnableContent
              networkId={networkId}
              accountId={accountId}
              deviceExportsViewKey={settings.accountSetup.deviceExportsViewKey}
              formRef={formRef}
              earliestBirthday={earliestBirthday}
              birthdayHintTimestamp={state.birthdayHintTimestamp}
            />
          ),
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_enable,
          }),
          onClose: finish,
          onConfirm: async ({ preventClose }) => {
            if (!isActive()) return;
            const birthday = readEnableBirthday(
              formRef.current,
              earliestBirthday,
              networkId,
            );
            if (!birthday) {
              Toast.error({
                title: intl.formatMessage({
                  id: getBirthdayInputError(formRef.current.mode),
                }),
              });
              preventClose();
              return;
            }
            try {
              await enable(birthday);
            } catch (error) {
              showError(error);
              if (!isLocalWalletSlotsFullError(error)) preventClose();
            }
          },
        });
      } catch (error) {
        showError(error);
        finish();
      }
    },
    [accountId, intl, networkId, onEnabled, onOpenSettings, scope, settings],
  );

  return { open, busy };
}
