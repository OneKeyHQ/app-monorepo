import { useTheme } from '@onekeyhq/components';

const speakerSource =
  require('@onekeyhq/components/svg/outline/speaker-promote.svg') as string;

export function MarketHighlightSpeaker() {
  const theme = useTheme();
  return (
    <div
      aria-hidden
      style={{
        width: 18,
        height: 18,
        flexShrink: 0,
        backgroundColor: theme.iconSubdued.val,
        // External SVG use elements briefly lose their drawing when cloned for recovery.
        maskImage: `url("${speakerSource}")`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
      }}
    />
  );
}
