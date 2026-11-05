import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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

import type { CardInfo } from '@onekeyfe/react-native-lite-card';

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
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const navigation = useAppNavigation();
  const backupWallet = useCallback(
    async (walletId?: string) => {
      if (busy.current) return false;
      busy.current = true;
      const log = createFlowLogger('backup');
      let attempt = 0;
      let isSuccess = false;
      log('flow-start');
      defaultLogger.setting.page.oneKeyLiteBackup();
      try {
        log('permission-start');
        await nfc.checkNFCEnabledPermission();
        log('permission-result');
        if (!mounted.current) return false;
        const { mnemonic, walletId: selectedWalletId } =
          await readMnemonicWithWalletId(walletId);
        if (!mounted.current) return false;
        log('encode-start');
        const encodedMnemonic =
          await backgroundApiProxy.serviceLiteCardMnemonic.encodeMnemonic(
            mnemonic,
          );
        log('encode-result');
        let expectedCard: CardInfo | undefined;
        while (mounted.current) {
          attempt += 1;
          log('native-start', { nativeMethod: 'getLiteInfo', attempt });
          const read = await nfc.createNFCConnection(() =>
            LiteCard.getLiteInfo(),
          )();
          log('native-result', {
            nativeMethod: 'getLiteInfo',
            attempt,
            errorCode: read.error?.code,
            hasCardInfo: Boolean(read.cardInfo),
            hasBackup: read.cardInfo?.hasBackup,
            isNewCard: read.cardInfo?.isNewCard,
          });
          if (!mounted.current) return false;
          const readAction = await nfc.handlerLiteCardError({
            error: read.error,
            cardInfo: read.cardInfo,
            lastCardInfo: expectedCard,
          });
          if (readAction === 'cancel')
            throw new OneKeyLocalError('Lite backup cancelled');
          if (!mounted.current) return false;
          if (readAction === 'continue') {
            const card = read.cardInfo;
            if (!card?.serialNum || typeof card.isNewCard !== 'boolean')
              throw new OneKeyLocalError('Lite card information missing');
            expectedCard = expectedCard ?? card;
            if (!card.isNewCard || card.hasBackup === true)
              await showBackupOverwrittenDialog();
            if (!mounted.current) return false;
            const pin = await showPINFormDialog(card.isNewCard);
            if (!mounted.current) return false;
            if (card.isNewCard) await showPINFormDialog(true, pin);
            if (!mounted.current) return false;
            const overwrite = !card.isNewCard || card.hasBackup === true;
            log('native-start', {
              nativeMethod: 'setMnemonic',
              attempt,
              overwrite,
            });
            const expectedSerial = expectedCard.serialNum;
            const write = await nfc.createNFCConnection(async () => {
              const result = await LiteCard.setMnemonic(
                encodedMnemonic,
                pin,
                overwrite,
                expectedSerial,
              );
              if (
                !result.error &&
                result.data === true &&
                result.cardInfo?.serialNum === expectedSerial &&
                selectedWalletId
              ) {
                // Persist even if unmounting cancelled the UI's NFC wait.
                await backgroundApiProxy.serviceAccount.updateWalletBackupStatus(
                  {
                    walletId: selectedWalletId,
                    isBackedUp: true,
                  },
                );
              }
              return result;
            })();
            if (!mounted.current) return false;
            log('native-result', {
              nativeMethod: 'setMnemonic',
              attempt,
              errorCode: write.error?.code,
              hasCardInfo: Boolean(write.cardInfo),
              hasBackup: write.cardInfo?.hasBackup,
              isNewCard: write.cardInfo?.isNewCard,
            });
            const writeAction = await nfc.handlerLiteCardError({
              error: write.error,
              cardInfo: write.cardInfo,
              lastCardInfo: card,
            });
            if (writeAction === 'cancel')
              throw new OneKeyLocalError('Lite backup cancelled');
            if (!mounted.current) return false;
            if (writeAction === 'continue') {
              if (
                write.data !== true ||
                write.cardInfo?.serialNum !== expectedSerial
              )
                throw new OneKeyLocalError('Lite backup result missing');
              if (selectedWalletId) {
                appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
              }
              showBackupSuccessDialog();
              log('flow-return');
              isSuccess = true;
              return true;
            }
          }
        }
        return false;
      } catch {
        if (mounted.current) {
          log('flow-caught');
        }
        return false;
      } finally {
        defaultLogger.setting.page.oneKeyLiteBackupResult({ isSuccess });
        busy.current = false;
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
    if (busy.current) return;
    busy.current = true;
    const log = createFlowLogger('import');
    let isSuccess = false;
    log('flow-start');
    defaultLogger.account.wallet.addWalletStarted({
      addMethod: 'ImportWallet',
      details: { importType: 'lite' },
      isSoftwareWalletOnlyUser,
    });
    try {
      log('permission-start');
      await nfc.checkNFCEnabledPermission();
      log('permission-result');
      if (!mounted.current) return;
      let pin = await showPINFormDialog();
      if (!mounted.current) return;
      while (mounted.current) {
        const currentPin = pin;
        log('native-start', { nativeMethod: 'getMnemonicWithPin' });
        const result = await nfc.createNFCConnection(() =>
          LiteCard.getMnemonicWithPin(currentPin),
        )();
        log('native-result', {
          nativeMethod: 'getMnemonicWithPin',
          errorCode: result.error?.code,
          hasCardInfo: Boolean(result.cardInfo),
          hasBackup: result.cardInfo?.hasBackup,
          isNewCard: result.cardInfo?.isNewCard,
        });
        if (!mounted.current) return;
        const action = await nfc.handlerLiteCardError({
          error: result.error,
          cardInfo: result.cardInfo,
        });
        if (action === 'cancel')
          throw new OneKeyLocalError('Lite import cancelled');
        if (!mounted.current) return;
        if (action === 'retryPin') pin = await showPINFormDialog();
        if (!mounted.current) return;
        if (action === 'continue') {
          log('decode-start');
          const mnemonicEncoded =
            await backgroundApiProxy.servicePassword.encodeSensitiveText({
              text: await backgroundApiProxy.serviceLiteCardMnemonic.decodeMnemonic(
                result.data ?? '',
              ),
            });
          log('decode-result');
          log('validate-start');
          await backgroundApiProxy.serviceAccount.validateMnemonic(
            mnemonicEncoded,
          );
          log('validate-result');
          if (!mounted.current) return;
          navigation.pushModal(EModalRoutes.OnboardingModal, {
            screen: EOnboardingPages.FinalizeWalletSetup,
            params: { mnemonic: mnemonicEncoded, isWalletBackedUp: true },
          });
          log('flow-return');
          isSuccess = true;
          return;
        }
      }
    } catch {
      if (mounted.current) {
        log('flow-caught');
      }
    } finally {
      defaultLogger.setting.page.oneKeyLiteImportResult({ isSuccess });
      defaultLogger.account.wallet.walletAdded({
        status: isSuccess ? 'success' : 'failure',
        addMethod: 'ImportWallet',
        details: { importType: 'lite' },
        isSoftwareWalletOnlyUser,
      });
      busy.current = false;
    }
  }, [nfc, showPINFormDialog, navigation, isSoftwareWalletOnlyUser]);
  const changePIN = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const log = createFlowLogger('changePIN');
    log('flow-start');
    try {
      log('permission-start');
      await nfc.checkNFCEnabledPermission();
      log('permission-result');
      if (!mounted.current) return;
      let pin = await showPINFormDialog();
      if (!mounted.current) return;
      let expectedSerial: string | undefined;
      while (mounted.current) {
        const currentPin = pin;
        log('native-start', { nativeMethod: 'getMnemonicWithPin' });
        const read = await nfc.createNFCConnection(() =>
          LiteCard.getMnemonicWithPin(currentPin),
        )();
        log('native-result', {
          nativeMethod: 'getMnemonicWithPin',
          errorCode: read.error?.code,
          hasCardInfo: Boolean(read.cardInfo),
          hasBackup: read.cardInfo?.hasBackup,
          isNewCard: read.cardInfo?.isNewCard,
        });
        if (!mounted.current) return;
        if (read.error?.code === CardErrors.NotInitializedError) {
          await nfc.hideNFCConnectDialog();
          if (!mounted.current) return;
          showChangePINOnNewCardDialog();
          return;
        }
        const readAction = await nfc.handlerLiteCardError({
          error: read.error,
          cardInfo: read.cardInfo,
        });
        if (readAction === 'cancel') return;
        if (!mounted.current) return;
        if (readAction === 'retryPin') pin = await showPINFormDialog();
        if (!mounted.current) return;
        if (readAction === 'continue') {
          const card = read.cardInfo;
          if (
            !card?.serialNum ||
            (expectedSerial && expectedSerial !== card.serialNum)
          )
            return;
          expectedSerial = expectedSerial ?? card.serialNum;
          Toast.success({ title: 'Lite PIN Verified' });
          const newPIN = await showPINFormDialog(true);
          if (!mounted.current) return;
          await showPINFormDialog(true, newPIN);
          if (!mounted.current) return;
          const write = await nfc.createNFCConnection(() =>
            LiteCard.changePin(currentPin, newPIN),
          )();
          if (!mounted.current) return;
          const writeAction = await nfc.handlerLiteCardError({
            error: write.error,
            cardInfo: write.cardInfo,
            lastCardInfo: card,
          });
          if (writeAction === 'cancel') return;
          if (!mounted.current) return;
          if (writeAction === 'retryPin') pin = await showPINFormDialog();
          if (!mounted.current) return;
          if (writeAction === 'continue') {
            log('flow-return');
            showChangePINSuccessDialog();
            return;
          }
        }
      }
    } catch {
      if (mounted.current) log('flow-caught');
    } finally {
      busy.current = false;
    }
  }, [
    nfc,
    showPINFormDialog,
    showChangePINOnNewCardDialog,
    showChangePINSuccessDialog,
  ]);
  const reset = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const log = createFlowLogger('reset');
    log('flow-start');
    try {
      log('permission-start');
      await nfc.checkNFCEnabledPermission();
      log('permission-result');
      if (!mounted.current) return;
      await showResetWarningDialog();
      while (mounted.current) {
        log('native-start', { nativeMethod: 'reset' });
        const result = await nfc.createNFCConnection(() => LiteCard.reset())();
        log('native-result', {
          nativeMethod: 'reset',
          errorCode: result.error?.code,
          hasCardInfo: Boolean(result.cardInfo),
          hasBackup: result.cardInfo?.hasBackup,
          isNewCard: result.cardInfo?.isNewCard,
        });
        if (!mounted.current) return;
        const action = await nfc.handlerLiteCardError({
          error: result.error,
          cardInfo: result.cardInfo,
        });
        if (action === 'cancel') return;
        if (!mounted.current) return;
        if (action === 'continue') {
          log('flow-return');
          showResetSuccessDialog();
          return;
        }
      }
    } catch {
      if (mounted.current) log('flow-caught');
    } finally {
      busy.current = false;
    }
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
