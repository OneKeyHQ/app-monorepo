import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSpeedFast = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2M5.757 17A7.98 7.98 0 0 0 12 20a7.98 7.98 0 0 0 6.243-3zM12 4a8 8 0 0 0-7.416 11h6.798l3.17-6.342 1.79.895L13.618 15h5.798A8 8 0 0 0 12 4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSpeedFast;
