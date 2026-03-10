import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgClockAlert = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m13 11.586 2.914 2.914-1.414 1.414-3.5-3.5V7h2z" />
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16"
      clipRule="evenodd"
    />
    <Path d="M6.414 2.25 2 6.664.586 5.25 5 .836zm17 3L22 6.664 17.586 2.25 19 .836z" />
  </Svg>
);
export default SvgClockAlert;
