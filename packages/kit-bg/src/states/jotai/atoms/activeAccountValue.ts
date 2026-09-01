import type { IAssetSnapshotMeta } from '@onekeyhq/shared/types/assetSnapshot';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';
export type IAccountValueAtom =
  | {
      accountId: string;
      value: Record<string, string> | string;
      currency: string;
      assetSnapshotMetaByKey?: Record<string, IAssetSnapshotMeta>;
      assetSnapshotMeta?: IAssetSnapshotMeta;
    }
  | undefined;

export const {
  target: activeAccountValueAtom,
  use: useActiveAccountValueAtom,
} = globalAtom<IAccountValueAtom>({
  name: EAtomNames.activeAccountValueAtom,
  initialValue: undefined,
});
