import type { BRC20TextProps } from '@onekeyhq/engine/src/managers/nft';
import {
  BRC20TokenOperation,
  BRCTokenType,
} from '@onekeyhq/engine/src/types/token';

export function isBRC20Token(tokenAddress?: string) {
  return (
    tokenAddress?.startsWith('brc20') || tokenAddress?.startsWith('brc-20')
  );
}

export function parseTextProps(content: string) {
  try {
    const json = JSON.parse(content) as BRC20TextProps;
    return json;
  } catch (error) {
    console.log('parse InscriptionText error = ', error);
  }
}

export function isBRC20Content({
  content,
  contentType,
}: {
  content: string;
  contentType: string;
}) {
  if (contentType === 'text/plain;charset=utf-8') {
    const props = parseTextProps(content);
    if (props?.p === 'brc-20') {
      return true;
    }
  }
  return false;
}

export function createBRC20TransferText(amount: string, tick: string) {
  return JSON.stringify({
    p: BRCTokenType.BRC20,
    op: BRC20TokenOperation.Transfer,
    tick,
    amt: amount,
  });
}
