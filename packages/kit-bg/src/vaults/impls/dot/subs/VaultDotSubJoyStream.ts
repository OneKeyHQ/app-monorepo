import { methods } from '@substrate/txwrapper-polkadot';

import type { IEncodedTxDot } from '@onekeyhq/core/src/chains/dot/types';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import VaultDotSubCommon from './VaultDotSubCommon';

import type { INativeTransferBuildContext } from './VaultDotSubBase';
import type { Args } from '@substrate/txwrapper-polkadot';

class VaultDotSubJoyStream extends VaultDotSubCommon {
  override supportsNetwork(networkId: string, chainId: string): boolean {
    return networkId === 'dot--joystream' || chainId === 'joystream';
  }

  override async getAddressByTxArgs(args: Args): Promise<string | undefined> {
    return args.dest as string;
  }

  override async buildNativeTransfer(
    context: INativeTransferBuildContext,
  ): Promise<IEncodedTxDot> {
    const dest = hexUtils.addHexPrefix(
      bufferUtils.bytesToHex(context.toAccountId),
    ) as unknown as { id: string };
    if (context.keepAlive) {
      return methods.balances.transferKeepAlive(
        {
          value: context.amountValue,
          dest,
        },
        context.info,
        context.option,
      );
    }
    const unsigned = methods.balances.transfer(
      {
        value: context.amountValue,
        dest,
      },
      context.info,
      context.option,
    );
    return unsigned;
  }
}

export default VaultDotSubJoyStream;
