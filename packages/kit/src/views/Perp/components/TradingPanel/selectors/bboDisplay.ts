export function formatBboModeLabel(baseLabel: string, offsetTicks: 0 | 5) {
  if (offsetTicks === 0) {
    return baseLabel;
  }

  const labelWithoutLevel = baseLabel.replace(/\s*1\s*$/, '').trimEnd();
  return `${labelWithoutLevel} 5`;
}
