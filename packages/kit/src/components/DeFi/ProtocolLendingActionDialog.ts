import type {
  IProtocolLendingActionSource,
  IProtocolLendingActionType,
  IShowProtocolLendingActionDialogParams,
} from './ProtocolLendingActionDialogContent';

let protocolLendingActionDialogModulePromise:
  | Promise<typeof import('./ProtocolLendingActionDialogContent')>
  | undefined;

function loadProtocolLendingActionDialogModule() {
  protocolLendingActionDialogModulePromise ??=
    import('./ProtocolLendingActionDialogContent');
  return protocolLendingActionDialogModulePromise;
}

function showProtocolLendingActionDialog(
  params: IShowProtocolLendingActionDialogParams,
) {
  void loadProtocolLendingActionDialogModule()
    .then(({ showProtocolLendingActionDialog: showDialog }) => {
      showDialog(params);
    })
    .catch((error: Error) => {
      protocolLendingActionDialogModulePromise = undefined;
      console.error('Failed to load ProtocolLendingActionDialog:', error);
    });
}

export { showProtocolLendingActionDialog };
export type { IProtocolLendingActionSource, IProtocolLendingActionType };
