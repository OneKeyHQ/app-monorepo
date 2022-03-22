function walletIsHD(walletId: string): boolean {
  return walletId.startsWith('hd');
}

function walletIsImported(walletId: string): boolean {
  return walletId.startsWith('imported');
}

function walletCanBeRemoved(walletId: string): boolean {
  return walletIsHD(walletId) || walletId.startsWith('hw');
}

function walletNameCanBeUpdated(walletId: string): boolean {
  return walletCanBeRemoved(walletId);
}

export {
  walletIsHD,
  walletIsImported,
  walletCanBeRemoved,
  walletNameCanBeUpdated,
};
