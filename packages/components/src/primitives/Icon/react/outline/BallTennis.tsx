import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBallTennis = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeWidth={2}
      d="M6 5.292A8.98 8.98 0 0 1 9 12a8.98 8.98 0 0 1-3 6.708M6 5.292A8.98 8.98 0 0 0 3 12a8.98 8.98 0 0 0 3 6.708M6 5.292A8.97 8.97 0 0 1 12 3c2.305 0 4.408.867 6 2.292M6 18.708A8.97 8.97 0 0 0 12 21a8.97 8.97 0 0 0 6-2.292m0 0A8.98 8.98 0 0 1 15 12a8.98 8.98 0 0 1 3-6.708m0 13.416A8.98 8.98 0 0 0 21 12a8.98 8.98 0 0 0-3-6.708"
    />
  </Svg>
);
export default SvgBallTennis;
