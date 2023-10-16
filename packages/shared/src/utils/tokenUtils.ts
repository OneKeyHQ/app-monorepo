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

export async function parseBRC20Content({
  content,
  contentType,
  contentUrl,
}: {
  content: string | null;
  contentType: string;
  contentUrl?: string;
}) {
  let brc20Content = content;

  if (contentType === 'text/plain;charset=utf-8') {
    if (!brc20Content && contentUrl) {
      const response = await fetch(contentUrl);
      brc20Content = await response.text();
    }

    const props = parseTextProps(brc20Content ?? '');
    if (props?.p === 'brc-20') {
      return {
        isBRC20Content: true,
        brc20Content: props,
      };
    }
  }
  return {
    isBRC20Content: false,
    brc20Content: null,
  };
}

export function createBRC20TransferText(amount: string, tick: string) {
  return JSON.stringify({
    p: BRCTokenType.BRC20,
    op: BRC20TokenOperation.Transfer,
    tick,
    amt: amount,
  });
}
