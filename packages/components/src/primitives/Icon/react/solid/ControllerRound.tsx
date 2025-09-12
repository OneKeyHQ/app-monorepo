import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgControllerRound = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 2a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 2M5.75 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5m12.5 0a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5M12 14.5a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5"
    />
  </Svg>
);
export default SvgControllerRound;
