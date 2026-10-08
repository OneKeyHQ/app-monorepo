import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';

type IBuildAccountSelectorValues =
  typeof backgroundApiProxy.serviceAccountSelector.buildAccountSelectorAccountsValuesData;
type IBuildAccountSelectorValuesParams =
  Parameters<IBuildAccountSelectorValues>[0];
type IBuildAccountSelectorValuesResult =
  ReturnType<IBuildAccountSelectorValues>;

const inFlightRequests = new Map<string, IBuildAccountSelectorValuesResult>();

export function buildAccountSelectorAccountsValuesDataOnce(
  params: IBuildAccountSelectorValuesParams,
): IBuildAccountSelectorValuesResult {
  const requestKey = stableStringify(params);
  const existingRequest = inFlightRequests.get(requestKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request =
    backgroundApiProxy.serviceAccountSelector.buildAccountSelectorAccountsValuesData(
      params,
    );
  inFlightRequests.set(requestKey, request);
  const clearRequest = () => {
    if (inFlightRequests.get(requestKey) === request) {
      inFlightRequests.delete(requestKey);
    }
  };
  void request.then(clearRequest, clearRequest);
  return request;
}
