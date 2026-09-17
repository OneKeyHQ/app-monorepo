import timerUtils from '../../utils/timerUtils';

import type {
  ICreateOnramperClientParams,
  IOnramperCheckoutRequest,
  IOnramperClient,
  IOnramperEventListener,
  IOnramperEventName,
} from './type';

const delay = (ms: number) => timerUtils.wait(ms);

function mockError(code: string, message: string) {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

// Mock client so the whole buy UI can be built and reviewed on Simulator with no
// native package. Returns `button: null` (the action zone renders our own OneKey
// button in mock mode) and a fake quote derived from the amount. Dev-only
// forced-error hooks for reviewing S4/S5 use deliberately implausible amounts
// so they can't shadow genuine input ($1 used to force S5, which collided with
// real below-minimum tests): 111111 → structural, 222222 → retryable.
export function createMockOnramperClient(
  _params: ICreateOnramperClientParams,
): IOnramperClient {
  const listeners: Partial<
    Record<IOnramperEventName, Set<IOnramperEventListener>>
  > = {};

  return {
    isMock: true,
    async initialize() {
      await delay(300);
    },
    async getCheckoutRequirements(request: IOnramperCheckoutRequest) {
      await delay(500);
      if (request.amount === 111_111) {
        throw mockError('checkoutForbidden', 'Region blocked (mock)');
      }
      if (request.amount === 222_222) {
        throw mockError('temporaryFailure', 'Please try again (mock)');
      }
      const rate = 192.94;
      const networkFee = 0.42;
      const transactionFee = 3.99;
      return {
        button: null,
        quote: {
          quoteId: 'mock-quote',
          ramp: 'coinbase',
          rate,
          payout:
            Math.max(request.amount - networkFee - transactionFee, 0) / rate,
          paymentMethod: 'applepay',
          networkFee,
          transactionFee,
        },
      };
    },
    addEventListener(
      name: IOnramperEventName,
      listener: IOnramperEventListener,
    ) {
      const set = (listeners[name] ??= new Set());
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    },
    async reset() {
      // no-op for the mock
    },
    async signOut() {
      // no-op for the mock
    },
    destroy() {
      (Object.keys(listeners) as IOnramperEventName[]).forEach((name) => {
        listeners[name]?.clear();
      });
    },
  };
}
