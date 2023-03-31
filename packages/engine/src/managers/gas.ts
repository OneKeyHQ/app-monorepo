import { getBlockNativeGasInfo } from './blockNative';

async function getGasFeeInfo(parasm: { chainId: string }) {
  const {} = params;

  try {
    const blockNativeGasInfo = await getBlockNativeGasInfo();

    if (blockNativeGasInfo === null) {
    }

    return {
      extraInfo: {},
    };
  } catch (e) {
    // fallback to metamask
  }
}
