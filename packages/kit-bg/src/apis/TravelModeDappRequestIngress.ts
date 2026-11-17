import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import { runAfterTravelModeGateDelay } from '@onekeyhq/shared/src/travelMode/runtimeEnvironment';

export type IRunTravelModeDappRequestParams<T> = {
  onBlocked: () => T | Promise<T>;
  operation: () => Promise<T>;
};

type IWrapTravelModeDappRequestParams<TArgs extends unknown[], TResult> = {
  onBlocked: (...args: TArgs) => TResult | Promise<TResult>;
  operation: (...args: TArgs) => Promise<TResult>;
};

export class TravelModeDappRequestIngress {
  private isBlackoutInstalled = false;

  installRequestBlackout(): void {
    this.isBlackoutInstalled = true;
  }

  run<T>({
    onBlocked,
    operation,
  }: IRunTravelModeDappRequestParams<T>): Promise<T> {
    const rejectAfterDelay = () => runAfterTravelModeGateDelay(onBlocked);
    if (this.isBlackoutInstalled) {
      return rejectAfterDelay();
    }
    return travelModeManager.getRuntimeEnvironment().then((environment) =>
      environment.dappRequests.runWithBlockedResult({
        onBlocked: rejectAfterDelay,
        operation,
      }),
    );
  }

  wrap<TArgs extends unknown[], TResult>({
    onBlocked,
    operation,
  }: IWrapTravelModeDappRequestParams<TArgs, TResult>): (
    ...args: TArgs
  ) => Promise<TResult> {
    return (...args) =>
      this.run({
        onBlocked: () => onBlocked(...args),
        operation: () => operation(...args),
      });
  }
}

export const travelModeDappRequestIngress = new TravelModeDappRequestIngress();
