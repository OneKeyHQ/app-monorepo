import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCupChampionWin = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M19 4h3v3a4 4 0 0 1-3.668 3.985 7 7 0 0 1-5.328 3.942V16H18v6H6v-6h5.004v-1.072a7 7 0 0 1-5.337-3.943A4 4 0 0 1 2 7V4h3V2h14zM8 20h8v-2H8zM7 8a5 5 0 0 0 10 0V4H7zM4 6v1c0 .757.42 1.415 1.041 1.755A7 7 0 0 1 5 8V6zm15 2q0 .383-.042.755A2 2 0 0 0 20 7V6h-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCupChampionWin;
