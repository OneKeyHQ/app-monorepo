import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';
import { NO_LOG_OUTPUT } from '../../../types';

type ICardInfo = {
  hasBackup: boolean | null;
  isNewCard: boolean;
  serialNum: string;
  pinRetryCount: number;
} | null;

type ICardError = { code: number; message: string | null };

export type ILiteCardDiagnostic = {
  operation: 'backup' | 'import' | 'changePIN' | 'reset' | 'pin' | 'nfc';
  operationId: string;
  phase:
    | 'flow-start'
    | 'permission-start'
    | 'permission-result'
    | 'callback-enter'
    | 'native-start'
    | 'native-result'
    | 'encode-start'
    | 'encode-result'
    | 'decode-start'
    | 'decode-result'
    | 'validate-start'
    | 'validate-result'
    | 'flow-return'
    | 'flow-caught'
    | 'dialog-show-request'
    | 'dialog-show-returned'
    | 'pin-confirm-resolve'
    | 'dialog-close-start'
    | 'dialog-close'
    | 'connect-confirm'
    | 'connection-event'
    | 'hide-request'
    | 'hide-settled'
    | 'error-handler'
    | 'retry-nfc'
    | 'retry-pin';
  nativeMethod?:
    | 'getLiteInfo'
    | 'getMnemonicWithPin'
    | 'setMnemonic'
    | 'changePin'
    | 'reset';
  elapsedMs?: number;
  attempt?: number;
  errorCode?: number;
  eventCode?: number;
  hasCardInfo?: boolean;
  hasBackup?: boolean | null;
  isNewCard?: boolean;
  overwrite?: boolean;
  hasDialogRef?: boolean;
  isSetNewPassword?: boolean;
  isConfirm?: boolean;
  isSuccess?: boolean;
  closeReason?: 'confirm' | 'cancel' | 'other';
};

const operations = new Set<string>([
  'backup',
  'import',
  'changePIN',
  'reset',
  'pin',
  'nfc',
]);
const phases = new Set<string>([
  'flow-start',
  'permission-start',
  'permission-result',
  'callback-enter',
  'native-start',
  'native-result',
  'encode-start',
  'encode-result',
  'decode-start',
  'decode-result',
  'validate-start',
  'validate-result',
  'flow-return',
  'flow-caught',
  'dialog-show-request',
  'dialog-show-returned',
  'pin-confirm-resolve',
  'dialog-close-start',
  'dialog-close',
  'connect-confirm',
  'connection-event',
  'hide-request',
  'hide-settled',
  'error-handler',
  'retry-nfc',
  'retry-pin',
]);
const nativeMethods = new Set<string>([
  'getLiteInfo',
  'getMnemonicWithPin',
  'setMnemonic',
  'changePin',
  'reset',
]);
// Protocol error codes are projected without native messages or payloads.
const errorCodes = new Set([
  1000, 1001, 1002, 1003, 2001, 2002, 2003, 2004, 3001, 3002, 3003, 3004, 3005,
  3006, 4000, 4001, 4002,
]);
const legacyMessages = new Set<string>([
  'connected lite setMnemonic',
  'setMnemonic result',
  'getMnemonicWithPin result',
  'reset card result',
]);

function knownErrorCode(code?: number) {
  return typeof code === 'number' && errorCodes.has(code) ? code : undefined;
}

function booleanState(value?: boolean | null) {
  return typeof value === 'boolean' ? value : undefined;
}

export class HardwareLiteCardScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public log(
    message: string,
    { cardInfo, error }: { cardInfo?: ICardInfo; error?: ICardError | null },
  ) {
    return {
      message: legacyMessages.has(message) ? message : 'lite-card',
      hasCardInfo: Boolean(cardInfo),
      hasBackup: booleanState(cardInfo?.hasBackup),
      isNewCard: booleanState(cardInfo?.isNewCard),
      errorCode: knownErrorCode(error?.code),
    };
  }

  @LogToLocal({ level: 'info' })
  public diagnostic(event: ILiteCardDiagnostic) {
    if (!operations.has(event.operation) || !phases.has(event.phase)) {
      return NO_LOG_OUTPUT;
    }
    return {
      operation: event.operation,
      phase: event.phase,
      operationId:
        typeof event.operationId === 'string' &&
        /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
          event.operationId,
        )
          ? event.operationId
          : undefined,
      eventTimeMs: Date.now(),
      elapsedMs:
        typeof event.elapsedMs === 'number' &&
        Number.isFinite(event.elapsedMs) &&
        event.elapsedMs >= 0
          ? event.elapsedMs
          : undefined,
      attempt:
        typeof event.attempt === 'number' &&
        Number.isSafeInteger(event.attempt) &&
        event.attempt >= 1
          ? event.attempt
          : undefined,
      nativeMethod:
        typeof event.nativeMethod === 'string' &&
        nativeMethods.has(event.nativeMethod)
          ? event.nativeMethod
          : undefined,
      errorCode: knownErrorCode(event.errorCode),
      eventCode:
        event.eventCode === 1 || event.eventCode === 2 || event.eventCode === 3
          ? event.eventCode
          : undefined,
      hasCardInfo: booleanState(event.hasCardInfo),
      hasBackup: booleanState(event.hasBackup),
      isNewCard: booleanState(event.isNewCard),
      overwrite: booleanState(event.overwrite),
      hasDialogRef: booleanState(event.hasDialogRef),
      isSetNewPassword: booleanState(event.isSetNewPassword),
      isConfirm: booleanState(event.isConfirm),
      isSuccess: booleanState(event.isSuccess),
      closeReason:
        event.closeReason === 'confirm' ||
        event.closeReason === 'cancel' ||
        event.closeReason === 'other'
          ? event.closeReason
          : undefined,
    };
  }
}
