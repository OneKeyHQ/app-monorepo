const MAX_DISPLAY_PAIR_NAME_SEGMENTS = 3;

export function formatDisplayPairName(pairName: string) {
  const pairNameSegments = pairName.split('/');
  const displayPairName = pairNameSegments
    .slice(0, MAX_DISPLAY_PAIR_NAME_SEGMENTS)
    .join('/');

  return pairNameSegments.length > MAX_DISPLAY_PAIR_NAME_SEGMENTS
    ? `${displayPairName}...`
    : displayPairName;
}
