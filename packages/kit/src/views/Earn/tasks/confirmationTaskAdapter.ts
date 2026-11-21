import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type {
  IEarnTransactionTaskAdapter,
  IEarnTransactionTaskPreparation,
} from './transactionTaskController';

type ICertainty = 'beforeSend' | 'unknown';
type IConfirmationCallbacks<TSuccess, TError> = {
  onSuccess: (data: TSuccess) => void | Promise<void>;
  onFail: (error: TError) => void;
  onCancel: () => void;
  onSendObserved: () => void;
  onLateBroadcastAccepted: (txid: string) => boolean;
};

export function createEarnConfirmationLifecycle() {
  let closed = false;
  return {
    isClosed: () => closed,
    close: () => {
      closed = true;
    },
    beforeSend: (check: () => Promise<void>) => check(),
  };
}

/** One adapter instance represents one navigation attempt. */
export function createEarnConfirmationTaskAdapter<
  TIdentity,
  TStep,
  TPrepared,
  TSuccess,
  TError,
>({
  prepare,
  navigate,
  onSuccess,
  onBroadcastAccepted,
  onFail,
  onCancel,
  onObserverError,
  getTxid,
  failureCertainty,
  cancellationCertainty,
}: {
  prepare: (
    context: Parameters<
      IEarnTransactionTaskAdapter<TIdentity, TStep, TPrepared, never>['prepare']
    >[0],
  ) => Promise<TPrepared>;
  navigate: (
    prepared: TPrepared,
    callbacks: IConfirmationCallbacks<TSuccess, TError>,
  ) => Promise<void>;
  onSuccess?: (data: TSuccess, prepared: TPrepared) => void | Promise<void>;
  onBroadcastAccepted?: (txid: string) => void;
  onFail?: (error: TError, prepared: TPrepared) => void;
  onCancel?: (prepared: TPrepared) => void;
  onObserverError: (error: unknown) => void;
  getTxid: (data: TSuccess) => string | undefined;
  failureCertainty: (error: TError) => ICertainty;
  cancellationCertainty: () => ICertainty;
}) {
  type IPreparation = IEarnTransactionTaskPreparation<TPrepared, never>;
  let resolveNavigation: (result: 'finished' | 'notStarted') => void = () =>
    undefined;
  let rejectNavigation: (error: unknown) => void = () => undefined;
  let navigationStarted = false;
  let taskStarted = false;
  const navigation = new Promise<'finished' | 'notStarted'>(
    (resolve, reject) => {
      resolveNavigation = resolve;
      rejectNavigation = reject;
    },
  );
  const observe = (update: () => void) => {
    try {
      update();
    } catch (error) {
      try {
        onObserverError(error);
      } catch {
        console.error('Unable to report Earn task observer error');
      }
    }
  };
  const adapter: IEarnTransactionTaskAdapter<
    TIdentity,
    TStep,
    TPrepared,
    IPreparation
  > = {
    confirmationLifecycle: 'detached',
    prepare: async (context) => {
      try {
        const prepared = await prepare(context);
        if (context.signal.aborted) resolveNavigation('notStarted');
        else {
          context.signal.addEventListener(
            'abort',
            () => {
              if (!navigationStarted) resolveNavigation('notStarted');
            },
            { once: true },
          );
        }
        return { type: 'confirm', prepared };
      } catch (error) {
        rejectNavigation(error);
        throw error;
      }
    },
    confirm: async ({
      prepared,
      onSubmitted,
      onSendObserved,
      onConfirmationFailed,
      onConfirmationCancelled,
      onConfirmationSettled,
      onLateBroadcastAccepted,
    }) => {
      navigationStarted = true;
      let observedSuccess = false;
      try {
        await navigate(prepared, {
          onSuccess: (data) => {
            if (onConfirmationSettled) {
              if (observedSuccess) return;
              observedSuccess = true;
              let result: void | Promise<void> = undefined;
              let callbackFailed = false;
              try {
                result = onSuccess?.(data, prepared);
              } catch (error) {
                callbackFailed = true;
                throw error;
              } finally {
                let txid = '';
                observe(() => {
                  txid = getTxid(data) ?? '';
                });
                observe(() => {
                  if (onSubmitted(txid) && txid.trim())
                    onBroadcastAccepted?.(txid);
                });
                if (callbackFailed)
                  observe(() => onConfirmationSettled('failed'));
              }
              if (result) {
                return result.then(
                  () => observe(() => onConfirmationSettled('success')),
                  (error) => {
                    observe(() => onConfirmationSettled('failed'));
                    throw error;
                  },
                );
              }
              observe(() => onConfirmationSettled('success'));
              return result;
            }
            try {
              return onSuccess?.(data, prepared);
            } finally {
              let txid = '';
              observe(() => {
                txid = getTxid(data) ?? '';
              });
              observe(() => {
                if (onSubmitted(txid) && txid.trim())
                  onBroadcastAccepted?.(txid);
              });
            }
          },
          onFail: (error) => {
            try {
              onFail?.(error, prepared);
            } finally {
              observe(() => {
                onConfirmationFailed(failureCertainty(error));
              });
            }
          },
          onCancel: () => {
            try {
              onCancel?.(prepared);
            } finally {
              observe(() => {
                onConfirmationCancelled(cancellationCertainty());
              });
            }
          },
          onSendObserved: () => observe(onSendObserved),
          onLateBroadcastAccepted: (txid) => {
            let accepted = false;
            observe(() => {
              accepted = onLateBroadcastAccepted(txid);
              if (accepted && txid.trim()) onBroadcastAccepted?.(txid);
            });
            return accepted;
          },
        });
        resolveNavigation('finished');
        return { type: 'detached' };
      } catch (error) {
        rejectNavigation(error);
        throw error;
      }
    },
    waitForFinalStatus: async () => {
      throw new OneKeyLocalError(
        'Confirmation handoff does not check chain status',
      );
    },
    verify: async () => {
      throw new OneKeyLocalError(
        'Confirmation handoff does not verify chain status',
      );
    },
  };
  const start = (runTask: () => Promise<void>) => {
    if (!taskStarted) {
      taskStarted = true;
      try {
        void runTask().then(() => {
          if (!navigationStarted) resolveNavigation('notStarted');
        }, rejectNavigation);
      } catch (error) {
        rejectNavigation(error);
      }
    }
    return navigation;
  };
  return { adapter, navigation, start };
}
