import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSpeedMiddle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2M5.757 17A7.98 7.98 0 0 0 12 20a7.98 7.98 0 0 0 6.243-3zM12 4a8 8 0 0 0-7.416 11H11V9a1 1 0 1 1 2 0v6h6.416A8 8 0 0 0 12 4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSpeedMiddle;
