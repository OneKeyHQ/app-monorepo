import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgControllerRoundRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 2a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 2M5.75 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5m2.5 10a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M18.25 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5M16.5 12a1.75 1.75 0 1 1 3.5 0 1.75 1.75 0 0 1-3.5 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgControllerRoundRight;
