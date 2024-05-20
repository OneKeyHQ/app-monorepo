import type { IToken } from '@onekeyhq/shared/types/token';

import { scriptToAddress } from './address';
import { decodeBalanceWithCell } from './balance';

import type { Cell } from '@ckb-lumos/base';
import type { Config } from '@ckb-lumos/config-manager';

export function convertTokenHistoryUtxos(
  cell: Cell[],
  mineAddress: string,
  tokenInfo: IToken,
  config: Config,
) {
  return cell?.map((c) => ({
    address: scriptToAddress(c.cellOutput.lock, { config }),
    balance: decodeBalanceWithCell(c, config)
      .shiftedBy(-tokenInfo.decimals)
      .toFixed(),
    balanceValue: decodeBalanceWithCell(c, config).toString(),
    symbol: tokenInfo.symbol,
    isMine: scriptToAddress(c.cellOutput.lock, { config }) === mineAddress,
  }));
}
