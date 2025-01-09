/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { values } from '@ckb-lumos/base';
import { bytes } from '@ckb-lumos/codec';

import type { CellDep, Script } from '@ckb-lumos/base';
import type { BytesLike } from '@ckb-lumos/codec';
import type { ScriptConfig } from '@ckb-lumos/config-manager';
import type { TransactionSkeletonType } from '@ckb-lumos/helpers';

export function createScript(
  config: ScriptConfig | undefined,
  args: BytesLike,
): Script | undefined {
  if (!config) {
    return undefined;
  }
  return {
    codeHash: config.CODE_HASH,
    hashType: config.HASH_TYPE,
    args: bytes.hexify(args),
  };
}

export function addCellDep(
  txSkeleton: TransactionSkeletonType,
  newCellDep: CellDep,
): TransactionSkeletonType {
  const cellDep = txSkeleton.get('cellDeps').find(
    // eslint-disable-next-line @typescript-eslint/no-shadow
    (cellDep) =>
      cellDep.depType === newCellDep.depType &&
      new values.OutPointValue(cellDep.outPoint, { validate: false }).equals(
        new values.OutPointValue(newCellDep.outPoint, { validate: false }),
      ),
  );

  if (!cellDep) {
    // eslint-disable-next-line no-param-reassign
    txSkeleton = txSkeleton.update('cellDeps', (cellDeps) =>
      cellDeps.push({
        outPoint: newCellDep.outPoint,
        depType: newCellDep.depType,
      }),
    );
  }

  return txSkeleton;
}
