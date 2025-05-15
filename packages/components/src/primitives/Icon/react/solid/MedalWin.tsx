import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMedalWin = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 9a8 8 0 1 1 13 6.245v5.79a1.75 1.75 0 0 1-2.533 1.566L12 21.367 9.533 22.6A1.75 1.75 0 0 1 7 21.035v-5.79A7.99 7.99 0 0 1 4 9m5 7.419v4.212l2.217-1.109a1.75 1.75 0 0 1 1.566 0L15 20.631v-4.212A8 8 0 0 1 12 17a8 8 0 0 1-3-.581"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMedalWin;
