/* eslint-disable new-cap */
import TonWeb from 'tonweb';

export async function genAddressFromPublicKey(
  publicKey: string,
  contractVersion: keyof typeof TonWeb.Wallets.all = 'v3R2',
): Promise<{
  normalAddress: string;
  nonBounceAddress: string;
  bounceAddress: string;
}> {
  const wallet = new TonWeb.Wallets.all[contractVersion](undefined as any, {
    publicKey: Buffer.from(publicKey, 'hex'),
  });
  const address = await wallet.getAddress();
  const normalAddress = address.toString(false, false, false);
  const nonBounceAddress = address.toString(true, true, false);
  const bounceAddress = address.toString(true, true, true);
  return { normalAddress, nonBounceAddress, bounceAddress };
}

export async function genAddressFromAddress(address: string): Promise<{
  normalAddress: string;
  nonBounceAddress: string;
  bounceAddress: string;
}> {
  const addr = new TonWeb.Address(address);
  const normalAddress = addr.toString(false, false, false);
  const nonBounceAddress = addr.toString(true, true, false);
  const bounceAddress = addr.toString(true, true, true);
  return { normalAddress, nonBounceAddress, bounceAddress };
}
