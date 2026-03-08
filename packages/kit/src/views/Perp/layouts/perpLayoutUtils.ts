export function calculateMaxLevelsPerSide(containerHeight: number): number {
  // The vertical web order book renders:
  // - Root padding: 1px top + 1px bottom (2px)
  // - Table header (Price/Size/Total): 24px
  // - Spread row: 24px + 1px marginTop (25px)
  // - Each level row: 24px + 1px marginTop (25px)
  //
  // Total height: baseHeight(51px) + 2 * levelsPerSide * 25px
  const baseHeight = 2 + 24 + 25;
  const levelRowStep = 25;

  if (containerHeight <= 0) return 11;
  if (containerHeight <= baseHeight) return 3;

  let levelsPerSide = Math.floor(
    (containerHeight - baseHeight) / (2 * levelRowStep),
  );
  levelsPerSide = Math.max(3, Math.min(levelsPerSide, 50));

  // If we have a noticeable gap, prefer one extra level and accept a tiny clip
  // instead of showing empty space.
  const usedHeight = baseHeight + 2 * levelsPerSide * levelRowStep;
  const blank = containerHeight - usedHeight;
  if (blank > levelRowStep / 2 && levelsPerSide < 50) {
    levelsPerSide += 1;
  }

  return levelsPerSide;
}
