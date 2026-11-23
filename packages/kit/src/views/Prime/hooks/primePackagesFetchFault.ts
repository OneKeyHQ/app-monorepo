import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IPrimeFetchPackagesFault } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';

type ISimulatedErrorCode = Exclude<
  IPrimeFetchPackagesFault,
  'off' | 'emptyOffering' | 'chinaStorefront'
>;

const SIMULATED_ERROR_MESSAGES: Record<ISimulatedErrorCode, string> = {
  '0': 'unknown error',
  '2': 'store problem',
  '3': 'purchase not allowed',
  '5': 'product not available',
  '10': 'network error',
  '23': 'None of the products registered in the RevenueCat dashboard could be fetched',
  '33': 'API endpoint blocked',
};

// Shapes follow the native PurchasesError (string `code`) so the simulated
// error goes through the same classification and analytics as a real one.
function buildSimulatedError(code: ISimulatedErrorCode) {
  return {
    code,
    message: `[Simulated] ${SIMULATED_ERROR_MESSAGES[code]}`,
    underlyingErrorMessage: '',
  };
}

export type IPrimeSimulatedPackagesFault = {
  // Undefined means the store returned an empty offering without an error.
  error?: ReturnType<typeof buildSimulatedError>;
  // Overrides the purchase account Storefront.
  storefrontCountryCode?: string;
};

export async function getPrimeSimulatedPackagesFault(): Promise<
  IPrimeSimulatedPackagesFault | undefined
> {
  try {
    const devSettings =
      await backgroundApiProxy.serviceDevSetting.getDevSetting();
    const fault = devSettings?.enabled
      ? devSettings.settings?.primeFetchPackagesFault
      : undefined;
    switch (fault) {
      case undefined:
      case 'off':
        return undefined;
      case 'emptyOffering':
        return {};
      case 'chinaStorefront':
        // What a mainland China Apple Account gets: code 23 on a CHN Storefront.
        return {
          error: buildSimulatedError('23'),
          storefrontCountryCode: 'CHN',
        };
      default:
        return { error: buildSimulatedError(fault) };
    }
  } catch {
    // Dev overrides must never block plan loading.
    return undefined;
  }
}
