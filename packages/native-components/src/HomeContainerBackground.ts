function resolveHomeContainerBackgroundColor({
  slotBackgroundColor,
  snapshotBackgroundColor,
}: {
  slotBackgroundColor?: string;
  snapshotBackgroundColor?: string;
}): string {
  return snapshotBackgroundColor ?? slotBackgroundColor ?? '#FFFFFF';
}

export { resolveHomeContainerBackgroundColor };
