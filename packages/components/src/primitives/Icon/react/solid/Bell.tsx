import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBell = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 2a7.307 7.307 0 0 0-7.298 6.943l-.18 3.588a1 1 0 0 1-.104.397L3.19 15.382A1.81 1.81 0 0 0 4.809 18H7.1a5.002 5.002 0 0 0 9.8 0h2.291a1.81 1.81 0 0 0 1.618-2.618l-1.227-2.454a1 1 0 0 1-.104-.397l-.18-3.588A7.31 7.31 0 0 0 12 2m0 18a3 3 0 0 1-2.83-2h5.66A3 3 0 0 1 12 20"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBell;
