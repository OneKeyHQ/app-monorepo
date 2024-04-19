/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable no-param-reassign */
import { utils } from '@ckb-lumos/base';
import { BI } from '@ckb-lumos/bi';
import { bytes, number } from '@ckb-lumos/codec';
import { common, secp256k1Blake160 } from '@ckb-lumos/common-scripts';
import { getConfig } from '@ckb-lumos/config-manager';
import {
  minimalCellCapacityCompatible,
  parseAddress,
} from '@ckb-lumos/helpers';
import BigNumber from 'bignumber.js';
import fetch from 'cross-fetch';
import { List, Set } from 'immutable';

import type { Token as IToken } from '@onekeyhq/engine/src/types/token';

import {
  MinimumTransferBalanceRequiredForSendingAssetError,
  OneKeyValidatorError,
} from '../../../../errors';

import { addCellDep } from './script';

import type { PartialTokenInfo } from '../../../../types/provider';
import type { XUDTInfoResponse } from '../types/TokenInfo';
import type {
  Address,
  Cell,
  CellCollector as CellCollectorType,
  Hash,
  HexString,
  Script,
} from '@ckb-lumos/base';
import type { BIish } from '@ckb-lumos/bi';
import type { BytesLike } from '@ckb-lumos/codec';
import type { Config } from '@ckb-lumos/config-manager';
import type { Options, TransactionSkeletonType } from '@ckb-lumos/helpers';

export type Token = Hash;

export function generateXudtScript(token: Hash, config: Config): Script {
  const SUDT_SCRIPT = config.SCRIPTS.XUDT!;
  // TODO: check token is a valid hash
  return {
    codeHash: SUDT_SCRIPT.CODE_HASH,
    hashType: SUDT_SCRIPT.HASH_TYPE,
    args: token,
  };
}

export function unpackAmount(data: BytesLike): BI {
  return number.Uint128.unpack(bytes.bytify(data).slice(0, 16));
}

export function packAmount(amount: BIish): HexString {
  return bytes.hexify(number.Uint128.pack(amount));
}

export async function transfer(
  txSkeleton: TransactionSkeletonType,
  fromAddress: Address,
  token: IToken,
  xudtToken: Token,
  toAddress: Address | null | undefined,
  amount: BIish,
  changeAddress?: Address,
  capacity?: BIish,
  {
    config = undefined,
    requireToAddress = true,
    splitChangeCell = false,
  }: Options & {
    requireToAddress?: boolean;
    splitChangeCell: false;
  } = {
    requireToAddress: true,
    splitChangeCell: false,
  },
): Promise<TransactionSkeletonType> {
  config = config || getConfig();
  const _amount = BI.from(amount);
  let _capacity = capacity ? BI.from(capacity) : undefined;

  const XUDT_SCRIPT = config.SCRIPTS.XUDT;
  if (!XUDT_SCRIPT) {
    throw new Error('Provided config does not have XUDT script setup!');
  }

  const fromScript = parseAddress(fromAddress, { config });

  if (requireToAddress && !toAddress) {
    throw new Error('You must provide a to address!');
  }

  const toScript = parseAddress(toAddress, { config });

  const changeOutputLockScript = changeAddress
    ? parseAddress(changeAddress, { config })
    : fromScript;

  if (_amount.lte(0)) {
    throw new Error('amount must be greater than 0');
  }

  const xudtType = generateXudtScript(xudtToken, config);

  const cellProvider = txSkeleton.get('cellProvider');
  if (!cellProvider) {
    throw new Error('Cell provider is missing!');
  }

  // support ANYONE_CAN_PAY address

  const targetOutput: Cell = {
    cellOutput: {
      capacity: '0x0',
      lock: toScript,
      type: xudtType,
    },
    data: packAmount(_amount),
    outPoint: undefined,
    blockHash: undefined,
  };

  if (!_capacity) {
    _capacity = BI.from(minimalCellCapacityCompatible(targetOutput));
  }
  targetOutput.cellOutput.capacity = `0x${_capacity.toString(16)}`;

  // collect cells with which includes xUDT info
  txSkeleton = txSkeleton.update('outputs', (outputs) =>
    outputs.push(targetOutput),
  );

  txSkeleton = txSkeleton.update('fixedEntries', (fixedEntries) =>
    fixedEntries.push({
      field: 'outputs',
      index: txSkeleton.get('outputs').size - 1,
    }),
  );

  txSkeleton = addCellDep(txSkeleton, {
    outPoint: {
      txHash: XUDT_SCRIPT.TX_HASH,
      index: XUDT_SCRIPT.INDEX,
    },
    depType: XUDT_SCRIPT.DEP_TYPE,
  });

  // collect cells
  const changeCell: Cell = {
    cellOutput: {
      capacity: '0x0',
      lock: changeOutputLockScript,
      type: xudtType,
    },
    data: packAmount(0),
    outPoint: undefined,
    blockHash: undefined,
  };

  const changeCellWithoutXudt: Cell = {
    cellOutput: {
      capacity: '0x0',
      lock: changeOutputLockScript,
      type: undefined,
    },
    data: '0x',
    outPoint: undefined,
    blockHash: undefined,
  };

  let changeCapacity = BI.from(0);
  let changeAmount = BI.from(0);
  let previousInputs = Set<string>();
  for (const input of txSkeleton.get('inputs')) {
    previousInputs = previousInputs.add(
      `${input.outPoint!.txHash}_${input.outPoint!.index}`,
    );
  }

  let cellCollectorInfos: List<{
    cellCollector: CellCollectorType;
    index: number;
    isAnyoneCanPay?: boolean;
    destroyable?: boolean;
  }> = List();

  const xUDTsecpCollector = new secp256k1Blake160.CellCollector(
    fromAddress,
    cellProvider,
    {
      config,
      queryOptions: {
        type: xudtType,
        data: 'any',
      },
    },
  );

  const secpCollector = new secp256k1Blake160.CellCollector(
    fromAddress,
    cellProvider,
    {
      config,
    },
  );

  cellCollectorInfos = cellCollectorInfos.push(
    {
      cellCollector: xUDTsecpCollector,
      index: 0,
    },
    {
      cellCollector: secpCollector,
      index: 0,
    },
  );

  let _totalCapacity = BI.from(0);
  let _totalAmount = BI.from(0);

  let _totalTokenCapacity = BI.from(0);
  let _requiresExtraNativeToken = BI.from(0);

  let done = false;
  for (const { cellCollector } of cellCollectorInfos) {
    for await (const inputCell of cellCollector.collect()) {
      if (done) {
        break;
      }

      // skip inputs already exists in txSkeleton.inputs
      const key = `${inputCell.outPoint!.txHash}_${inputCell.outPoint!.index}`;
      if (previousInputs.has(key)) {
        // eslint-disable-next-line no-continue
        continue;
      }
      previousInputs = previousInputs.add(key);

      const fromInfo = fromAddress;
      txSkeleton = await common.setupInputCell(
        txSkeleton,
        inputCell,
        fromInfo,
        {
          config,
        },
      );
      // remove output which added by `setupInputCell`
      const lastOutputIndex: number = txSkeleton.get('outputs').size - 1;
      txSkeleton = txSkeleton.update('outputs', (outputs) =>
        outputs.remove(lastOutputIndex),
      );
      // remove output fixedEntry
      const fixedEntryIndex: number = txSkeleton
        .get('fixedEntries')
        .findIndex(
          (fixedEntry) =>
            fixedEntry.field === 'outputs' &&
            fixedEntry.index === lastOutputIndex,
        );
      if (fixedEntryIndex >= 0) {
        txSkeleton = txSkeleton.update('fixedEntries', (fixedEntries) =>
          fixedEntries.remove(fixedEntryIndex),
        );
      }
      const inputCapacity: BI = BI.from(inputCell.cellOutput.capacity);
      const inputAmount: BI = inputCell.cellOutput.type
        ? unpackAmount(inputCell.data)
        : BI.from(0);

      _totalCapacity = _totalCapacity.add(inputCapacity);
      _totalAmount = _totalAmount.add(inputAmount);
      if (inputCell.cellOutput.type?.args === xudtToken) {
        _totalTokenCapacity = _totalTokenCapacity.add(inputCapacity);
      }

      const requiresAmount = _amount;

      let requiresCapacity = minimalCellCapacityCompatible(targetOutput);
      if (_totalAmount.gt(requiresAmount)) {
        requiresCapacity = requiresCapacity.add(
          minimalCellCapacityCompatible(changeCell),
        );
      }
      const targetCapacity = requiresCapacity.add(
        minimalCellCapacityCompatible(changeCellWithoutXudt),
      );

      _requiresExtraNativeToken = targetCapacity.sub(_totalTokenCapacity);
      if (
        _totalCapacity.gt(targetCapacity) &&
        _totalAmount.gte(requiresAmount)
      ) {
        changeCapacity = _totalCapacity.sub(requiresCapacity);
        changeAmount = _totalAmount.sub(requiresAmount);

        done = true;
        break;
      }
    }
  }

  if (!done || changeAmount.lt(0) || changeCapacity.lt(0)) {
    throw new MinimumTransferBalanceRequiredForSendingAssetError(
      `${new BigNumber(amount.toString())
        .shiftedBy(-token.decimals)
        .toString()} ${token.symbol}`,
      _requiresExtraNativeToken.div(10 ** 8).toString(),
      'CKB',
    );
  }

  const minimalChangeCellWithoutSudtCapacity = BI.from(
    minimalCellCapacityCompatible(changeCellWithoutXudt),
  );

  if (changeCapacity.gte(minimalChangeCellWithoutSudtCapacity)) {
    const minimalChangeCellCapcaity = BI.from(
      minimalCellCapacityCompatible(changeCell),
    );

    changeCell.cellOutput.capacity = `0x${minimalChangeCellCapcaity.toString(
      16,
    )}`;
    if (changeAmount.gt(0)) {
      changeCell.data = packAmount(changeAmount);
    }

    if (changeCapacity.gt(0)) {
      changeCellWithoutXudt.cellOutput.capacity = `0x${changeCapacity.toString(
        16,
      )}`;
    }

    if (changeAmount.gt(0)) {
      txSkeleton = txSkeleton.update('outputs', (outputs) =>
        outputs.push(changeCell),
      );

      txSkeleton = txSkeleton.update('fixedEntries', (fixedEntries) =>
        fixedEntries.push({
          field: 'outputs',
          index: txSkeleton.get('outputs').size - 1,
        }),
      );
    }

    txSkeleton = txSkeleton.update('outputs', (outputs) =>
      outputs.push(changeCellWithoutXudt),
    );
  } else if (
    changeAmount.gt(0) &&
    changeCapacity.lt(minimalCellCapacityCompatible(changeCell))
  ) {
    throw new Error('Not enough capacity for change in from infos!');
  }

  return txSkeleton;
}

export async function getTokenInfo(
  token: Token,
  config: Config,
): Promise<PartialTokenInfo | undefined> {
  const xudtScript = generateXudtScript(token, config);
  const scriptHash = utils.computeScriptHash(xudtScript);

  try {
    const response = await fetch(
      `https://mainnet-api.explorer.nervos.org/api/v1/xudts/${scriptHash}`,
      {
        headers: {
          'Content-Type': 'application/vnd.api+json',
          'Accept': 'application/vnd.api+json',
        },
      },
    );

    if (response.status === 200) {
      const res = JSON.parse(await response.text()) as XUDTInfoResponse;
      if (
        res.data.attributes.type_script.args.toLowerCase() ===
        token.toLowerCase()
      ) {
        return {
          name: res.data.attributes.full_name,
          symbol: res.data.attributes.symbol,
          decimals: parseInt(res.data.attributes.decimal),
        };
      }
    }
  } catch (error) {
    // ignore
  }
  return undefined;
}
