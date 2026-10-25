import { getTokenValue } from '@onekeyhq/components';
import { preloadImages } from '@onekeyhq/components/src/primitives/Image/preload';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getTokenImageResizeWidth } from '@onekeyhq/kit/src/components/Token/tokenSize';
import { buildSwapTokenFetchParams } from '@onekeyhq/kit/src/views/Swap/hooks/swapTokenFetchParamsUtils';
import {
  SWAP_LP_TOKEN_FILTER_SERVER_SUPPORTED,
  isTokenSelectorDappTokenFilterSupportedNetwork,
} from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import { swapPopularTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  ESwapTabSwitchType,
  type ISwapNetwork,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

// What Pay with's picker reads before it can draw, kept here so a deposit
// form can read it ahead and the picker opens complete

const pickerNetworks = new Map<string, ISwapNetwork>();
const pickerNetworkReads = new Map<string, Promise<ISwapNetwork>>();

// The deposit's network as Swap's picker uses it: name and logo from the
// app's own list, and what decides the DeFi tokens switch (the backend index
// and whether DeFi is on there), all local reads where Swap asks its
// server for the whole network list
export function readPayWithPickerNetwork(
  networkId: string,
): Promise<ISwapNetwork> {
  const reading = pickerNetworkReads.get(networkId);
  if (reading) {
    return reading;
  }
  const read = (async () => {
    const [network, deFiState] = await Promise.all([
      backgroundApiProxy.serviceNetwork.getNetworkSafe({ networkId }),
      backgroundApiProxy.serviceDeFi
        .getDeFiEnabledNetworksMapState({ syncIfEmpty: false })
        .catch(() => undefined),
    ]);
    const item: ISwapNetwork = {
      networkId,
      name: network?.name ?? '',
      symbol: network?.symbol ?? '',
      logoURI: network?.logoURI,
      backendIndex: network?.backendIndex ?? false,
      ...(deFiState?.isReady
        ? { isDeFiEnabled: Boolean(deFiState.enabledNetworksMap[networkId]) }
        : {}),
    };
    pickerNetworks.set(networkId, item);
    return item;
  })();
  pickerNetworkReads.set(networkId, read);
  // Read again next time, so a network's state that changes is seen
  void read.finally(() => pickerNetworkReads.delete(networkId));
  return read;
}

export function getPayWithPickerNetwork(networkId: string) {
  return pickerNetworks.get(networkId);
}

const pickerAccountAddresses = new Map<string, string>();

// The wallet's address on the network, for the list's balances; '' without
// one, and the list comes without balances
export async function readPayWithPickerAccountAddress({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const address = accountId
    ? await backgroundApiProxy.serviceAccount
        .getAccountAddressForApi({ accountId, networkId })
        .catch(() => '')
    : '';
  pickerAccountAddresses.set(`${accountId}|${networkId}`, address);
  return address;
}

export function getPayWithPickerAccountAddress({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  return pickerAccountAddresses.get(`${accountId}|${networkId}`);
}

// The last full list per network, account, filter and currency: the picker
// shows it at once on opening again, as Swap shows its last list
export const payWithPickerTokenLists = new Map<string, ISwapToken[]>();

// Swap's DeFi tokens switch, where the network has one
export function isPayWithPickerLpFilterShown({
  networkId,
  network,
}: {
  networkId: string;
  network?: ISwapNetwork;
}) {
  return (
    SWAP_LP_TOKEN_FILTER_SERVER_SUPPORTED &&
    Boolean(network) &&
    isTokenSelectorDappTokenFilterSupportedNetwork({
      network: {
        id: networkId,
        isAllNetworks: false,
        backendIndex: network?.backendIndex,
      },
      isDeFiEnabled: network?.isDeFiEnabled,
    })
  );
}

type IPayWithPickerTokensRequest = {
  accountId: string;
  networkId: string;
  accountAddress: string;
  // Sent only where the network has the DeFi tokens switch
  lpToken?: boolean;
  currencyId: string;
  keyword: string;
};

export function buildPayWithPickerRequestKey({
  networkId,
  accountAddress,
  lpToken,
  currencyId,
  keyword,
}: IPayWithPickerTokensRequest) {
  return [networkId, accountAddress, String(lpToken), currencyId, keyword].join(
    '|',
  );
}

const pickerTokenReads = new Map<string, Promise<ISwapToken[]>>();

// A list as Swap's picker asks for it; a full one is kept for the next open.
// A read of a list already on its way shares that request: Swap's service
// cancels its earlier list request when another one starts
export function readPayWithPickerTokens(request: IPayWithPickerTokensRequest) {
  const requestKey = buildPayWithPickerRequestKey(request);
  const reading = pickerTokenReads.get(requestKey);
  if (reading) {
    return reading;
  }
  const { accountId, networkId, accountAddress, lpToken, currencyId, keyword } =
    request;
  const read = backgroundApiProxy.serviceSwap
    .fetchSwapTokens(
      buildSwapTokenFetchParams({
        currentNetworkId: networkId,
        keywords: keyword || undefined,
        swapType: ESwapTabSwitchType.SWAP,
        lpToken,
        requestCurrency: currencyId,
        shouldUseCurrentAccountAddress: Boolean(accountAddress),
        currentAccountAddress: accountAddress || undefined,
        currentAccountNetworkId: networkId,
        currentAccountId: accountId,
      }),
    )
    .then((tokens) => {
      if (!keyword) {
        payWithPickerTokenLists.set(requestKey, tokens);
      }
      return tokens;
    });
  pickerTokenReads.set(requestKey, read);
  void read
    .catch(() => undefined)
    .finally(() => {
      if (pickerTokenReads.get(requestKey) === read) {
        pickerTokenReads.delete(requestKey);
      }
    });
  return read;
}

// Rows a picker shows before any scrolling
const PRELOADED_ROW_LOGOS = 10;
const preloadedLogoNetworks = new Set<string>();

// The logos of the first rows and of the Popular token chips, at the sizes
// they are drawn at (a row's token at its size, a chip's image at its own),
// so they are in the first frame with the rows rather than a moment after
function preloadPayWithPickerLogos({
  networkId,
  tokens,
  isWide,
}: {
  networkId: string;
  tokens: ISwapToken[];
  isWide: boolean;
}) {
  const key = `${networkId}|${String(isWide)}`;
  if (preloadedLogoNetworks.has(key)) {
    return;
  }
  preloadedLogoNetworks.add(key);
  const rowResizeWidth = getTokenImageResizeWidth('lg');
  const chipSize = getTokenValue(isWide ? '$5' : '$4.5', 'size');
  void preloadImages([
    ...tokens
      .slice(0, PRELOADED_ROW_LOGOS)
      .filter((token) => token.logoURI)
      .map((token) => ({ uri: token.logoURI, resizeWidth: rowResizeWidth })),
    ...(swapPopularTokens[networkId] ?? [])
      .filter((token) => token.logoURI)
      .map((token) => ({
        uri: token.logoURI,
        width: chipSize,
        height: chipSize,
      })),
  ]);
}

// The network's full list read ahead while a deposit form with Pay with
// shows, so the picker's first open has its rows and their logos. Nothing
// more once one is kept: the picker reads it again as it opens
export async function warmPayWithPickerTokens({
  accountId,
  networkId,
  currencyId,
  showLpTokensOnly,
  isWide,
}: {
  accountId: string;
  networkId: string;
  currencyId: string;
  showLpTokensOnly: boolean;
  // The picker's layout: its chips are drawn at another size on phones
  isWide: boolean;
}) {
  try {
    const [network, accountAddress] = await Promise.all([
      readPayWithPickerNetwork(networkId),
      readPayWithPickerAccountAddress({ accountId, networkId }),
    ]);
    const request: IPayWithPickerTokensRequest = {
      accountId,
      networkId,
      accountAddress,
      lpToken: isPayWithPickerLpFilterShown({ networkId, network })
        ? showLpTokensOnly
        : undefined,
      currencyId,
      keyword: '',
    };
    const tokens =
      payWithPickerTokenLists.get(buildPayWithPickerRequestKey(request)) ??
      (await readPayWithPickerTokens(request));
    preloadPayWithPickerLogos({ networkId, tokens, isWide });
  } catch {
    // The picker asks for its list itself
  }
}
