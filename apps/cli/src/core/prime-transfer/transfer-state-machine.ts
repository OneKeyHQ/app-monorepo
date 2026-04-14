import type {
  ITransferStateSnapshot,
  TransferStateEvent,
  TransferStateListener,
  TransferStatePredicate,
  TransferStateStatus,
} from './transfer-types';

const TRANSFER_STATE_EVENT_MAP: Record<
  TransferStateEvent,
  {
    status: TransferStateStatus;
    message: string;
    isTerminal: boolean;
  }
> = {
  pairing_started: {
    status: 'pairing',
    message:
      'Waiting for OneKey App to scan the QR code or enter the pairing code...',
    isTerminal: false,
  },
  pairing_verified: {
    status: 'paired',
    message: 'OneKey App connected. Waiting for export confirmation...',
    isTerminal: false,
  },
  transfer_receiving: {
    status: 'receiving',
    message: 'Receiving the encrypted wallet payload from OneKey App...',
    isTerminal: false,
  },
  transfer_importing: {
    status: 'importing',
    message: 'Importing the transferred wallet into CLI...',
    isTerminal: false,
  },
  transfer_completed: {
    status: 'completed',
    message: 'Transfer completed.',
    isTerminal: true,
  },
  transfer_cancelled: {
    status: 'cancelled',
    message: 'Transfer cancelled.',
    isTerminal: true,
  },
  transfer_timeout: {
    status: 'timeout',
    message: 'Transfer timed out.',
    isTerminal: true,
  },
  transfer_failed: {
    status: 'failed',
    message: 'Transfer failed.',
    isTerminal: true,
  },
};

interface ICreateTransferStateMachineOptions {
  now?: () => Date;
}

interface IStateWaiter {
  predicate: TransferStatePredicate;
  resolve: (state: ITransferStateSnapshot) => void;
}

function buildTransferStateSnapshot(
  event: TransferStateEvent,
  now: () => Date,
): ITransferStateSnapshot {
  const mappedState = TRANSFER_STATE_EVENT_MAP[event];

  return {
    event,
    status: mappedState.status,
    message: mappedState.message,
    isTerminal: mappedState.isTerminal,
    updatedAt: now().toISOString(),
  };
}

export function createTransferStateMachine({
  now = () => new Date(),
}: ICreateTransferStateMachineOptions = {}) {
  let currentState = buildTransferStateSnapshot('pairing_started', now);
  const listeners = new Set<TransferStateListener>();
  const waiters = new Set<IStateWaiter>();

  const flushWaiters = () => {
    for (const waiter of waiters) {
      if (waiter.predicate(currentState)) {
        waiters.delete(waiter);
        waiter.resolve(currentState);
      }
    }
  };

  const notifyListeners = () => {
    for (const listener of listeners) {
      listener(currentState);
    }
  };

  return {
    getState(): ITransferStateSnapshot {
      return currentState;
    },
    subscribe(listener: TransferStateListener): () => void {
      listeners.add(listener);
      listener(currentState);
      return () => {
        listeners.delete(listener);
      };
    },
    transition(event: TransferStateEvent): ITransferStateSnapshot {
      if (currentState.isTerminal) {
        return currentState;
      }

      currentState = buildTransferStateSnapshot(event, now);
      notifyListeners();
      flushWaiters();
      return currentState;
    },
    waitForState(
      predicate: TransferStatePredicate,
    ): Promise<ITransferStateSnapshot> {
      if (predicate(currentState)) {
        return Promise.resolve(currentState);
      }

      return new Promise<ITransferStateSnapshot>((resolve) => {
        waiters.add({ predicate, resolve });
      });
    },
  };
}
