import { Toast } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import type {
  IProtocolLendingActionSource,
  IProtocolLendingActionType,
  IShowProtocolLendingActionDialogParams,
} from './ProtocolLendingActionDialogContent';
import type { IntlShape } from 'react-intl';

type IProtocolLendingActionDialogModule =
  typeof import('./ProtocolLendingActionDialogContent');

type IShowProtocolLendingActionDialogWrapperParams =
  IShowProtocolLendingActionDialogParams & {
    intl: IntlShape;
  };

let protocolLendingActionDialogModulePromise:
  | Promise<IProtocolLendingActionDialogModule>
  | undefined;
let hasRequestedProtocolLendingActionDialogPreload = false;
let protocolLendingActionDialogOpenRequestId = 0;

function loadProtocolLendingActionDialogModule() {
  protocolLendingActionDialogModulePromise ??=
    import('./ProtocolLendingActionDialogContent');
  return protocolLendingActionDialogModulePromise;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function showProtocolLendingActionDialogLoadErrorToast(intl: IntlShape) {
  Toast.error({
    title: intl.formatMessage({
      id: ETranslations.global_network_error,
    }),
    message: intl.formatMessage({
      id: ETranslations.global_network_error_help_text,
    }),
  });
}

function preloadProtocolLendingActionDialog() {
  if (
    hasRequestedProtocolLendingActionDialogPreload ||
    protocolLendingActionDialogModulePromise
  ) {
    return;
  }
  hasRequestedProtocolLendingActionDialogPreload = true;
  void loadProtocolLendingActionDialogModule().catch((error) => {
    hasRequestedProtocolLendingActionDialogPreload = false;
    protocolLendingActionDialogModulePromise = undefined;
    defaultLogger.app.error.log(
      `Failed to preload ProtocolLendingActionDialog: ${getErrorMessage(
        error,
      )}`,
    );
  });
}

function showProtocolLendingActionDialog({
  intl,
  ...params
}: IShowProtocolLendingActionDialogWrapperParams) {
  const openRequestId = (protocolLendingActionDialogOpenRequestId += 1);
  let isOpenRequestActive = true;
  void (async () => {
    let protocolLendingActionDialogModule: IProtocolLendingActionDialogModule;
    try {
      protocolLendingActionDialogModule =
        await loadProtocolLendingActionDialogModule();
    } catch (error) {
      protocolLendingActionDialogModulePromise = undefined;
      defaultLogger.app.error.log(
        `Failed to load ProtocolLendingActionDialog: ${getErrorMessage(error)}`,
      );
      if (
        !isOpenRequestActive ||
        openRequestId !== protocolLendingActionDialogOpenRequestId
      ) {
        return;
      }
      showProtocolLendingActionDialogLoadErrorToast(intl);
      return;
    }

    if (
      !isOpenRequestActive ||
      openRequestId !== protocolLendingActionDialogOpenRequestId
    ) {
      return;
    }

    try {
      protocolLendingActionDialogModule.showProtocolLendingActionDialog(params);
    } catch (error) {
      defaultLogger.app.error.log(
        `Failed to show ProtocolLendingActionDialog: ${getErrorMessage(error)}`,
      );
    }
  })();

  return () => {
    isOpenRequestActive = false;
    if (openRequestId === protocolLendingActionDialogOpenRequestId) {
      protocolLendingActionDialogOpenRequestId += 1;
    }
  };
}

export { preloadProtocolLendingActionDialog, showProtocolLendingActionDialog };
export type { IProtocolLendingActionSource, IProtocolLendingActionType };
