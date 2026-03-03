import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgXCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 8.586-3-3L7.586 9l3 3-3 3L9 16.414l3-3 3 3L16.414 15l-3-3 3-3L15 7.586z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgXCircle;
