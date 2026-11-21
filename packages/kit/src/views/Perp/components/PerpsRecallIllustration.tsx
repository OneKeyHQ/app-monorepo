import Svg, { G, Path } from 'react-native-svg';

import { useTheme } from '@onekeyhq/components';

export function PerpsRecallBackTicket({
  strokeWidth = 2.5,
}: {
  strokeWidth?: number;
}) {
  const theme = useTheme();
  const outline = theme.text.val;
  const accent = theme.bgAccent.val;
  return (
    <G transform="rotate(-20 67 50)">
      <Path
        d="M24 21H111Q115 21 115 25V38C103 38 103 54 115 54V67Q115 71 111 71H24Q20 71 20 67V54C32 54 32 38 20 38V25Q20 21 24 21Z"
        fill={theme.bgStrong.val}
      />
      <Path
        d="M96 21H111Q115 21 115 25V38C103 38 103 54 115 54V67Q115 71 111 71H96Z"
        fill={accent}
      />
      <Path
        d="M24 21H111Q115 21 115 25V38C103 38 103 54 115 54V67Q115 71 111 71H24Q20 71 20 67V54C32 54 32 38 20 38V25Q20 21 24 21Z"
        fill="none"
        stroke={outline}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </G>
  );
}

export function PerpsRecallFrontTicket({
  strokeWidth = 2.5,
  simplified = false,
}: {
  strokeWidth?: number;
  simplified?: boolean;
}) {
  const theme = useTheme();
  const outline = theme.text.val;
  const accent = theme.bgAccent.val;
  return (
    <G transform="rotate(10 78 80)">
      <Path
        d="M36 49H122Q126 49 126 53V67C114 67 114 83 126 83V97Q126 101 122 101H36Q32 101 32 97V83C44 83 44 67 32 67V53Q32 49 36 49Z"
        fill={theme.bg.val}
      />
      <Path
        d="M105 49H122Q126 49 126 53V67C114 67 114 83 126 83V97Q126 101 122 101H105Z"
        fill={accent}
      />
      <Path
        d="M36 49H122Q126 49 126 53V67C114 67 114 83 126 83V97Q126 101 122 101H36Q32 101 32 97V83C44 83 44 67 32 67V53Q32 49 36 49Z"
        fill="none"
        stroke={outline}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d={
          simplified
            ? 'M105 58V64M105 73V79M105 88V94'
            : 'M105 57V62M105 69V74M105 81V86M105 93V96'
        }
        stroke={theme.textInverse.val}
        strokeWidth={simplified ? 3.5 : 2}
      />
      <Path
        d="M82 65C79 61 64 61 64 69C64 77 82 73 82 81C82 89 67 89 64 85M73 58V92"
        fill="none"
        stroke={outline}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </G>
  );
}

export function PerpsRecallSparkle({ small = false }: { small?: boolean }) {
  const theme = useTheme();
  return (
    <Path
      d={
        small
          ? 'M15 82L17 87L22 89L17 91L15 96L13 91L8 89L13 87Z'
          : 'M132 29L135 36L142 39L135 42L132 49L129 42L122 39L129 36Z'
      }
      fill={theme.text.val}
    />
  );
}

export function PerpsRecallIllustration({
  trimmed = false,
}: {
  trimmed?: boolean;
}) {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={trimmed ? '4 2 142 112' : '0 0 144 128'}
    >
      <PerpsRecallBackTicket />
      <PerpsRecallFrontTicket />
      <PerpsRecallSparkle />
      <PerpsRecallSparkle small />
    </Svg>
  );
}
