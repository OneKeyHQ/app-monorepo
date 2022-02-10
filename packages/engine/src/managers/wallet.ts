function walletIsHD(walletId: string): boolean {
  return walletId.startsWith('hd');
}

function walletCanBeRemoved(walletId: string): boolean {
  return walletIsHD(walletId) || walletId.startsWith('hw');
}

function walletNameCanBeUpdated(walletId: string): boolean {
  return walletCanBeRemoved(walletId);
}

export { walletIsHD, walletCanBeRemoved, walletNameCanBeUpdated };
