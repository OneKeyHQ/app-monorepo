import { autoFixPersonalSignMessage } from '@onekeyhq/shared/src/utils/messageUtils';

import { ethers } from './ethers';

// Re-export from shared for backward compatibility
export { autoFixPersonalSignMessage };

export function verifyPersonalSignMessage({
  message,
  address,
  signature,
}: {
  message: string;
  address: string;
  signature: string;
}) {
  try {
    const messageHash = ethers.utils.hashMessage(message);
    const sig = ethers.utils.splitSignature(signature);
    const recoveredAddress = ethers.utils.recoverAddress(messageHash, {
      r: sig.r,
      s: sig.s,
      v: sig.v,
    });
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    console.log('verifyPersonalSignMessage error', error);
    return false;
  }
}
