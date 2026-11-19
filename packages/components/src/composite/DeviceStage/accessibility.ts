export type IDeviceStageCapsuleGlyph =
  | 'device'
  | 'done'
  | 'error'
  | 'bluetooth';

export function getCapsuleAccessibilityProps(
  capsuleGlyph: IDeviceStageCapsuleGlyph,
  capsuleTitle: string,
) {
  const isDone = capsuleGlyph === 'done';
  return {
    accessible: isDone,
    accessibilityLabel: isDone ? capsuleTitle : undefined,
    accessibilityLiveRegion: isDone ? ('polite' as const) : ('none' as const),
  };
}
