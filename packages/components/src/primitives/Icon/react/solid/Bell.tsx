import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBell = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2a7.307 7.307 0 0 0-7.298 6.943l-.19 3.798-1.321 2.641A1.81 1.81 0 0 0 4.809 18H7.1a5.002 5.002 0 0 0 9.8 0h2.291a1.81 1.81 0 0 0 1.618-2.618l-1.32-2.641-.19-3.798A7.31 7.31 0 0 0 12 2m0 18a3 3 0 0 1-2.83-2h5.66A3 3 0 0 1 12 20"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBell;
