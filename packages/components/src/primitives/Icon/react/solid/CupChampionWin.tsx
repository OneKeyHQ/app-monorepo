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
      d="M19 4h3v3a4 4 0 0 1-3.667 3.986 7.01 7.01 0 0 1-5.33 3.943V16H18v6H6v-6h5.004v-1.07a7.01 7.01 0 0 1-5.337-3.944A4 4 0 0 1 2 7V4h3V2h14zM4 7a2 2 0 0 0 1.04 1.755Q5 8.383 5 8V6H4zm15 1q0 .383-.04.755A2 2 0 0 0 20 7V6h-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCupChampionWin;
