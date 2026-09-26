export function getManualAddressVerificationPath({
  receiveAddressPath,
  accountPath,
  isBtcNetwork,
}: {
  receiveAddressPath?: string;
  accountPath?: string;
  isBtcNetwork: boolean;
}): string | undefined {
  // BTC account paths identify an xpub, not the displayed receiving address.
  return receiveAddressPath || (isBtcNetwork ? undefined : accountPath);
}
