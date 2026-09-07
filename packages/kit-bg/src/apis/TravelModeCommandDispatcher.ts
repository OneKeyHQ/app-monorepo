import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import { rejectTravelModeUnknownError } from '@onekeyhq/shared/src/travelMode/runtimeEnvironment';

import {
  isTravelModeRecoveryServiceCall,
  shouldRejectTravelModeServiceCall,
} from './travelModeCommandPolicy';

export class TravelModeCommandDispatcher {
  runTransportServiceCall<T>({
    method,
    operation,
  }: {
    method: string;
    operation: () => Promise<T>;
  }): Promise<T> {
    let [serviceName, methodName] = method.split('.');
    if (!methodName) {
      methodName = serviceName;
      serviceName = '';
    }
    if (serviceName === 'ROOT') {
      serviceName = '';
    }
    return this.runServiceCall({
      methodName,
      operation,
      serviceName,
    });
  }

  runServiceCall<T>({
    methodName,
    operation,
    serviceName,
  }: {
    methodName: string;
    operation: () => Promise<T>;
    serviceName: string;
  }): Promise<T> {
    if (!shouldRejectTravelModeServiceCall({ methodName, serviceName })) {
      return travelModeManager.getRuntimeState().then((runtimeState) => {
        if (
          runtimeState === 'transition-recovery' &&
          !isTravelModeRecoveryServiceCall({ methodName, serviceName })
        ) {
          return rejectTravelModeUnknownError();
        }
        return operation();
      });
    }
    return travelModeManager
      .getRuntimeEnvironment()
      .then((environment) => environment.commands.run(operation));
  }
}

export const travelModeCommandDispatcher = new TravelModeCommandDispatcher();
