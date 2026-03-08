import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMenuCircleVer = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 12.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5m0-4a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5m0-4a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMenuCircleVer;
