type IPrimeTransferImportProgressLike = {
  current: number;
  total: number;
  isImporting: boolean;
};

function getPrimeTransferImportProgressPercent(
  progress: IPrimeTransferImportProgressLike | undefined,
) {
  if (!progress) {
    return undefined;
  }
  if (progress.total > 0) {
    return Math.min(100, Math.ceil((progress.current / progress.total) * 100));
  }
  return progress.isImporting ? 0 : 100;
}

function getPrimeTransferImportProgressRange(percentage: number | undefined) {
  if (percentage === undefined) {
    return undefined;
  }
  if (percentage >= 80 && percentage < 90) {
    return '80-90';
  }
  if (percentage >= 100) {
    return '100';
  }
  const rangeStart = Math.floor(percentage / 10) * 10;
  return `${rangeStart}-${Math.min(rangeStart + 10, 100)}`;
}

export {
  getPrimeTransferImportProgressPercent,
  getPrimeTransferImportProgressRange,
};
