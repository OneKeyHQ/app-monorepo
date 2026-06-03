import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';
import { ETokenDappType } from '@onekeyhq/shared/types/token';
import type { ITokenDappType } from '@onekeyhq/shared/types/token';

export type ISwapKLineToken = ISwapToken & {
  defiMarked?: boolean;
  dappName?: string | null;
  dappType?: ITokenDappType;
};

const SWAP_KLINE_STABLE_TOKEN_SYMBOLS = new Set([
  'USDC',
  'USDT',
  'DAI',
  'FDUSD',
  'TUSD',
  'BUSD',
  'USDD',
  'USDE',
  'USDS',
  'FRAX',
  'LUSD',
  'GUSD',
  'PYUSD',
  'USD1',
  'USD0',
  'USDT0',
  'USDB',
  'USDH',
  'USDP',
  'USDX',
  'CRVUSD',
  'RLUSD',
  'DOLA',
  'MIM',
  'CUSD',
  'SUSD',
  'EURC',
  'EURS',
  'EURA',
  'USDCE',
  'USDTE',
  'AUSDT0',
  'SYRUPUSDT',
]);

function normalizeSwapKLineStableTokenSymbol(symbol?: string) {
  return (
    symbol
      ?.trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '') ?? ''
  );
}

export function isSwapKLineStableToken(token?: Pick<ISwapToken, 'symbol'>) {
  const symbol = normalizeSwapKLineStableTokenSymbol(token?.symbol);
  return SWAP_KLINE_STABLE_TOKEN_SYMBOLS.has(symbol);
}

export function isKnownSwapKLineUnsupportedToken(token?: ISwapKLineToken) {
  if (!token) {
    return false;
  }
  if (token.dappType === ETokenDappType.WalletToken) {
    return false;
  }
  return Boolean(token.defiMarked || token.dappName?.trim() || token.dappType);
}

export function getDefaultSwapKLineSide({
  fromToken,
  toToken,
}: {
  fromToken?: ISwapKLineToken;
  toToken?: ISwapKLineToken;
}): ESwapDirectionType {
  if (!toToken) {
    return ESwapDirectionType.FROM;
  }
  if (!fromToken) {
    return ESwapDirectionType.TO;
  }

  const fromIsKnownUnsupported = isKnownSwapKLineUnsupportedToken(fromToken);
  const toIsKnownUnsupported = isKnownSwapKLineUnsupportedToken(toToken);

  if (toIsKnownUnsupported && !fromIsKnownUnsupported) {
    return ESwapDirectionType.FROM;
  }
  if (fromIsKnownUnsupported && !toIsKnownUnsupported) {
    return ESwapDirectionType.TO;
  }

  if (!fromIsKnownUnsupported && !toIsKnownUnsupported) {
    const fromIsStable = isSwapKLineStableToken(fromToken);
    const toIsStable = isSwapKLineStableToken(toToken);
    if (fromIsStable !== toIsStable) {
      return fromIsStable ? ESwapDirectionType.TO : ESwapDirectionType.FROM;
    }
  }

  return ESwapDirectionType.TO;
}
