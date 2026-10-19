import { Stack } from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { ZcashMemo } from '@onekeyhq/kit/src/components/ZcashMemo';
import type { IEncodedTxZcash } from '@onekeyhq/kit-bg/src/vaults/impls/zcash/types';
import {
  IMPL_TRON,
  IMPL_ZCASH,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { getZcashMemoDisplay } from '@onekeyhq/shared/src/utils/zcashMemo';

import { TronSpecialInfo } from './TronSpecialInfo';

function ZcashSpecialInfo({ unsignedTxs }: { unsignedTxs: IUnsignedTxPro[] }) {
  return (
    <>
      {unsignedTxs.map(({ encodedTx }, index) => {
        const { zcashMemoHex } = encodedTx as IEncodedTxZcash;
        if (!zcashMemoHex) return null;
        const memo = getZcashMemoDisplay(zcashMemoHex);
        return (
          <Stack key={index} px="$5" py="$2.5">
            <ZcashMemo text={memo.text} binaryMemos={[memo]} />
          </Stack>
        );
      })}
    </>
  );
}

export function getTxSpecialInfo({ impl }: { impl: string }) {
  let component:
    | ((props: {
        accountId: string;
        networkId: string;
        unsignedTxs: IUnsignedTxPro[];
      }) => JSX.Element | null)
    | undefined;
  switch (impl) {
    case IMPL_TRON:
      component = TronSpecialInfo;
      break;
    case IMPL_ZCASH:
      component = ZcashSpecialInfo;
      break;
    default:
      break;
  }

  return component;
}
