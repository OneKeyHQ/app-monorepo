function walletIsHD(walletId: string): boolean {
  return walletId.startsWith('hd');
}

function walletIsHW(walletId: string): boolean {
  return walletId.startsWith('hw');
}

function walletIsImported(walletId: string): boolean {
  return walletId.startsWith('imported');
}

function walletCanBeRemoved(walletId: string): boolean {
  return walletIsHD(walletId) || walletIsHW(walletId);
}

function isWalletCompatibleAllNetworks(walletId?: string | null): boolean {
  if (!walletId) {
    return false;
  }
  return walletIsHD(walletId) || walletIsHW(walletId);
}

function isNostrCredentialId(credentialId: string): boolean {
  const split = credentialId.split('--');
  return split.length > 1 && split[1] === 'nostr';
}

export {
  walletIsHD,
  walletIsHW,
  walletIsImported,
  walletCanBeRemoved,
  isWalletCompatibleAllNetworks,
  isNostrCredentialId,
};
