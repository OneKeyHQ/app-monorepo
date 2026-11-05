import { useCallback, useMemo, useRef } from 'react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { ILiteCardDiagnostic } from '@onekeyhq/shared/src/logger/scopes/hardware/scenes/litecard';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import useAppNavigation from '../../../hooks/useAppNavigation';

import useNFC, { CardErrors, LiteCard } from './useNFC';
import useOperationDialog from './useOperationDialog';
import usePIN from './usePIN';
import useReadMnemonic from './useReadMnemonic';

function createFlowLogger(
  operation: 'backup' | 'import' | 'changePIN' | 'reset',
) {
  const operationId = generateUUID();
  const startedAt = Date.now();
  return (
    phase: ILiteCardDiagnostic['phase'],
    fields: Partial<ILiteCardDiagnostic> = {},
  ) => {
    defaultLogger.hardware.liteCard.diagnostic({
      ...fields,
      operation,
      operationId,
      phase,
      elapsedMs: Date.now() - startedAt,
    });
  };
}

export default function useLiteCard() {
  const nfc = useNFC();
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const { showPINFormDialog } = usePIN();
  const { readMnemonicWithWalletId } = useReadMnemonic();
  const {
    showBackupOverwrittenDialog,
    showResetWarningDialog,
    showBackupSuccessDialog,
    showChangePINOnNewCardDialog,
    showChangePINSuccessDialog,
    showResetSuccessDialog,
  } = useOperationDialog();
  const pin = useRef('');

  const navigation = useAppNavigation();
  const backupWallet = useCallback(
    async (walletId?: string) => {
      const log = createFlowLogger('backup');
      let attempt = 0;
      log('flow-start');
      defaultLogger.setting.page.oneKeyLiteBackup();
      try {
        log('permission-start');
        await nfc.checkNFCEnabledPermission();
        log('permission-result');
        const { mnemonic, walletId: selectedWalletId } =
          await readMnemonicWithWalletId(walletId);
        const createLiteInfoConnection = nfc.createNFCConnection(async () => {
          attempt += 1;
          const currentAttempt = attempt;
          log('callback-enter', {
            attempt: currentAttempt,
            nativeMethod: 'getLiteInfo',
          });
          log('native-start', {
            attempt: currentAttempt,
            nativeMethod: 'getLiteInfo',
          });
          const { error: oldError, cardInfo: oldCard } =
            await LiteCard.getLiteInfo();
          log('native-result', {
            attempt: currentAttempt,
            nativeMethod: 'getLiteInfo',
            errorCode: oldError?.code,
            hasCardInfo: Boolean(oldCard),
            hasBackup: oldCard?.hasBackup,
            isNewCard: oldCard?.isNewCard,
          });
          await nfc.handlerLiteCardError({
            error: oldError,
            cardInfo: oldCard,
            retryNFCAction: createLiteInfoConnection,
          });
          if (!oldCard?.isNewCard) {
            await showBackupOverwrittenDialog();
          }
          const isNewCard = oldCard?.isNewCard;
          const createPINConnection = async () => {
            pin.current = await showPINFormDialog(isNewCard);
          };
          await createPINConnection();
          if (isNewCard) {
            await showPINFormDialog(isNewCard, pin.current);
          }
          log('encode-start');
          const encodeMnemonic =
            await backgroundApiProxy.serviceLiteCardMnemonic.encodeMnemonic(
              mnemonic,
            );
          log('encode-result');

          const createSetMnemonicConnection = nfc.createNFCConnection(
            async () => {
              attempt += 1;
              const writeAttempt = attempt;
              log('callback-enter', {
                attempt: writeAttempt,
                nativeMethod: 'setMnemonic',
                overwrite: !isNewCard,
              });
              defaultLogger.hardware.liteCard.log(
                'connected lite setMnemonic',
                { cardInfo: oldCard },
              );
              log('native-start', {
                attempt: writeAttempt,
                nativeMethod: 'setMnemonic',
                overwrite: !isNewCard,
              });
              const { error: newError, cardInfo: newCard } =
                await LiteCard.setMnemonic(
                  encodeMnemonic,
                  pin.current,
                  !isNewCard,
                );
              log('native-result', {
                attempt: writeAttempt,
                nativeMethod: 'setMnemonic',
                errorCode: newError?.code,
                hasCardInfo: Boolean(newCard),
                hasBackup: newCard?.hasBackup,
                isNewCard: newCard?.isNewCard,
              });
              defaultLogger.hardware.liteCard.log('setMnemonic result', {
                cardInfo: newCard,
                error: newError,
              });
              await nfc.handlerLiteCardError({
                error: newError,
                cardInfo: newCard,
                lastCardInfo: oldCard,
                retryNFCAction: createSetMnemonicConnection,
                retryPINAction: createPINConnection,
              });
              showBackupSuccessDialog();
              if (selectedWalletId) {
                await backgroundApiProxy.serviceAccount.updateWalletBackupStatus(
                  {
                    walletId: selectedWalletId,
                    isBackedUp: true,
                  },
                );
                appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
              }
            },
          );
          await createSetMnemonicConnection();
        });
        await createLiteInfoConnection();
        log('flow-return');
        defaultLogger.setting.page.oneKeyLiteBackupResult({ isSuccess: true });
        return true;
      } catch {
        log('flow-caught');
        defaultLogger.setting.page.oneKeyLiteBackupResult({ isSuccess: false });
        return false;
      }
    },
    [
      nfc,
      showPINFormDialog,
      readMnemonicWithWalletId,
      showBackupOverwrittenDialog,
      showBackupSuccessDialog,
    ],
  );
  const importWallet = useCallback(async () => {
    const log = createFlowLogger('import');
    let attempt = 0;
    log('flow-start');
    defaultLogger.account.wallet.addWalletStarted({
      addMethod: 'ImportWallet',
      details: {
        importType: 'lite',
      },
      isSoftwareWalletOnlyUser,
    });
    try {
      log('permission-start');
      await nfc.checkNFCEnabledPermission();
      log('permission-result');
      const createPINConnection = async () => {
        pin.current = await showPINFormDialog();
      };
      await createPINConnection();
      const createGetMnemonicConnection = nfc.createNFCConnection(async () => {
        attempt += 1;
        const currentAttempt = attempt;
        log('callback-enter', {
          attempt: currentAttempt,
          nativeMethod: 'getMnemonicWithPin',
        });
        log('native-start', {
          attempt: currentAttempt,
          nativeMethod: 'getMnemonicWithPin',
        });
        const { error, data, cardInfo } = await LiteCard.getMnemonicWithPin(
          pin.current,
        );
        log('native-result', {
          attempt: currentAttempt,
          nativeMethod: 'getMnemonicWithPin',
          errorCode: error?.code,
          hasCardInfo: Boolean(cardInfo),
          hasBackup: cardInfo?.hasBackup,
          isNewCard: cardInfo?.isNewCard,
        });
        defaultLogger.hardware.liteCard.log('getMnemonicWithPin result', {
          cardInfo,
          error,
        });
        await nfc.handlerLiteCardError({
          error,
          cardInfo,
          retryNFCAction: createGetMnemonicConnection,
          retryPINAction: createPINConnection,
        });
        log('decode-start');
        const mnemonicDecoded =
          await backgroundApiProxy.serviceLiteCardMnemonic.decodeMnemonic(
            data ?? '',
          );
        log('decode-result');
        log('encode-start');
        const mnemonicEncoded =
          await backgroundApiProxy.servicePassword.encodeSensitiveText({
            text: mnemonicDecoded,
          });
        log('encode-result');
        log('validate-start');
        await backgroundApiProxy.serviceAccount.validateMnemonic(
          mnemonicEncoded,
        );
        log('validate-result');
        navigation.pushModal(EModalRoutes.OnboardingModal, {
          screen: EOnboardingPages.FinalizeWalletSetup,
          params: { mnemonic: mnemonicEncoded, isWalletBackedUp: true },
        });
      });
      await createGetMnemonicConnection();
      log('flow-return');
      defaultLogger.setting.page.oneKeyLiteImportResult({ isSuccess: true });
      defaultLogger.account.wallet.walletAdded({
        status: 'success',
        addMethod: 'ImportWallet',
        details: {
          importType: 'lite',
        },
        isSoftwareWalletOnlyUser,
      });
    } catch {
      log('flow-caught');
      defaultLogger.setting.page.oneKeyLiteImportResult({ isSuccess: false });
      defaultLogger.account.wallet.walletAdded({
        status: 'failure',
        addMethod: 'ImportWallet',
        details: {
          importType: 'lite',
        },
        isSoftwareWalletOnlyUser,
      });
    }
  }, [nfc, showPINFormDialog, navigation, isSoftwareWalletOnlyUser]);
  const changePIN = useCallback(async () => {
    const log = createFlowLogger('changePIN');
    let attempt = 0;
    log('flow-start');
    log('permission-start');
    await nfc.checkNFCEnabledPermission();
    log('permission-result');
    const createPINConnection = async () => {
      pin.current = await showPINFormDialog();
    };
    await createPINConnection();
    const createGetMnemonicConnection = nfc.createNFCConnection(async () => {
      attempt += 1;
      const currentAttempt = attempt;
      log('callback-enter', {
        attempt: currentAttempt,
        nativeMethod: 'getMnemonicWithPin',
      });
      log('native-start', {
        attempt: currentAttempt,
        nativeMethod: 'getMnemonicWithPin',
      });
      const { error: oldError, cardInfo: oldCard } =
        await LiteCard.getMnemonicWithPin(pin.current);
      log('native-result', {
        attempt: currentAttempt,
        nativeMethod: 'getMnemonicWithPin',
        errorCode: oldError?.code,
        hasCardInfo: Boolean(oldCard),
        hasBackup: oldCard?.hasBackup,
        isNewCard: oldCard?.isNewCard,
      });
      if (oldError?.code === CardErrors.NotInitializedError) {
        await nfc.hideNFCConnectDialog();
        showChangePINOnNewCardDialog();
        return;
      }
      await nfc.handlerLiteCardError({
        error: oldError,
        cardInfo: oldCard,
        retryNFCAction: createGetMnemonicConnection,
        retryPINAction: createPINConnection,
      });
      Toast.success({ title: 'Lite PIN Verified' });
      const newPIN = await showPINFormDialog(true);
      await showPINFormDialog(true, newPIN);
      const createChangePINConnection = nfc.createNFCConnection(async () => {
        attempt += 1;
        const writeAttempt = attempt;
        log('callback-enter', {
          attempt: writeAttempt,
          nativeMethod: 'changePin',
        });
        log('native-start', {
          attempt: writeAttempt,
          nativeMethod: 'changePin',
        });
        const { error: newError, cardInfo: newCard } = await LiteCard.changePin(
          pin.current,
          newPIN,
        );
        log('native-result', {
          attempt: writeAttempt,
          nativeMethod: 'changePin',
          errorCode: newError?.code,
          hasCardInfo: Boolean(newCard),
          hasBackup: newCard?.hasBackup,
          isNewCard: newCard?.isNewCard,
        });
        await nfc.handlerLiteCardError({
          error: newError,
          cardInfo: newCard,
          lastCardInfo: oldCard,
          retryNFCAction: createChangePINConnection,
          retryPINAction: createPINConnection,
        });
        showChangePINSuccessDialog();
      });
      await createChangePINConnection();
    });
    await createGetMnemonicConnection();
    log('flow-return');
  }, [
    nfc,
    showPINFormDialog,
    showChangePINOnNewCardDialog,
    showChangePINSuccessDialog,
  ]);
  const reset = useCallback(async () => {
    const log = createFlowLogger('reset');
    let attempt = 0;
    log('flow-start');
    log('permission-start');
    await nfc.checkNFCEnabledPermission();
    log('permission-result');
    await showResetWarningDialog();
    const createResetConnection = nfc.createNFCConnection(async () => {
      attempt += 1;
      const currentAttempt = attempt;
      log('callback-enter', { attempt: currentAttempt, nativeMethod: 'reset' });
      log('native-start', { attempt: currentAttempt, nativeMethod: 'reset' });
      const { error, cardInfo } = await LiteCard.reset();
      log('native-result', {
        attempt: currentAttempt,
        nativeMethod: 'reset',
        errorCode: error?.code,
        hasCardInfo: Boolean(cardInfo),
        hasBackup: cardInfo?.hasBackup,
        isNewCard: cardInfo?.isNewCard,
      });
      defaultLogger.hardware.liteCard.log('reset card result', {
        cardInfo,
        error,
      });
      await nfc.handlerLiteCardError({
        error,
        cardInfo,
        retryNFCAction: createResetConnection,
      });
      showResetSuccessDialog();
    });
    await createResetConnection();
    log('flow-return');
  }, [nfc, showResetWarningDialog, showResetSuccessDialog]);
  return useMemo(
    () => ({
      backupWallet,
      importWallet,
      changePIN,
      reset,
    }),
    [backupWallet, importWallet, changePIN, reset],
  );
}
