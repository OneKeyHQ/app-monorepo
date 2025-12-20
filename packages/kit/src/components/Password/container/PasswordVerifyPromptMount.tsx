import {
  PropsWithChildren,
  Suspense,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import { isNil } from 'lodash';
import { createPortal } from 'react-dom';
import { useIntl } from 'react-intl';

import { Dialog, Portal, Spinner } from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePasswordPromptPromiseTriggerAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { PASSWORD_VERIFY_CONTAINER_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';
import { EPasswordPromptType } from '@onekeyhq/shared/types/password';

import PasswordSetupContainer from './PasswordSetupContainer';
import PasswordVerifyContainer from './PasswordVerifyContainer';

const PasswordVerifyPromptMount = () => {
  const intl = useIntl();

  const [{ passwordPromptPromiseTriggerData }] =
    usePasswordPromptPromiseTriggerAtom();
  const onClose = useCallback((id: number) => {
    void backgroundApiProxy.servicePassword.cancelPasswordPromptDialog(id);
  }, []);

  const dialogRef = useRef<ReturnType<typeof Dialog.show> | null>(null);

  const showPasswordSetupPrompt = useCallback(
    (id: number) => {
      dialogRef.current = Dialog.show({
        title: intl.formatMessage({ id: ETranslations.global_set_passcode }),
        onClose() {
          onClose(id);
        },
        renderContent: (
          <Suspense fallback={<Spinner size="large" />}>
            <PasswordSetupContainer
              onSetupRes={async (data) => {
                await backgroundApiProxy.servicePassword.resolvePasswordPromptDialog(
                  id,
                  {
                    password: data,
                  },
                );
              }}
            />
          </Suspense>
        ),
        showFooter: false,
      });
    },
    [intl, onClose],
  );
  const showPasswordVerifyPrompt = useCallback(
    (id: number, dialogProps?: IDialogShowProps) => {
      dialogRef.current = Dialog.show({
        ...dialogProps,
        title: intl.formatMessage({
          id: ETranslations.enter_passcode,
        }),
        floatingPanelProps: platformEnv.isNative
          ? undefined
          : {
              zIndex: PASSWORD_VERIFY_CONTAINER_Z_INDEX,
            },
        portalContainer: platformEnv.isNative
          ? undefined
          : Portal.Constant.PASSWORD_VERIFY_CONTAINER_PORTAL,
        onClose() {
          onClose(id);
        },
        renderContent: (
          <Suspense fallback={<Spinner size="large" />}>
            <PasswordVerifyContainer
              onVerifyRes={async (data) => {
                await backgroundApiProxy.servicePassword.resolvePasswordPromptDialog(
                  id,
                  {
                    password: data,
                  },
                );
              }}
            />
          </Suspense>
        ),
        showFooter: false,
      });
    },
    [intl, onClose],
  );

  const showPasswordSetupPromptRef = useRef(showPasswordSetupPrompt);
  const showPasswordVerifyPromptRef = useRef(showPasswordVerifyPrompt);
  if (showPasswordSetupPromptRef.current !== showPasswordSetupPrompt) {
    showPasswordSetupPromptRef.current = showPasswordSetupPrompt;
  }
  if (showPasswordVerifyPromptRef.current !== showPasswordVerifyPrompt) {
    showPasswordVerifyPromptRef.current = showPasswordVerifyPrompt;
  }
  useEffect(() => {
    if (
      passwordPromptPromiseTriggerData &&
      !isNil(passwordPromptPromiseTriggerData.idNumber)
    ) {
      if (
        passwordPromptPromiseTriggerData.type ===
        EPasswordPromptType.PASSWORD_VERIFY
      ) {
        showPasswordVerifyPromptRef.current?.(
          passwordPromptPromiseTriggerData.idNumber,
          passwordPromptPromiseTriggerData.dialogProps,
        );
      } else {
        showPasswordSetupPromptRef.current?.(
          passwordPromptPromiseTriggerData.idNumber,
        );
      }
    } else {
      void dialogRef.current?.close();
    }
  }, [passwordPromptPromiseTriggerData]);

  return null;
};

export default PasswordVerifyPromptMount;
