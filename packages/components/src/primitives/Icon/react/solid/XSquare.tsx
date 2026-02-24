import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgXSquare = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zm-9-10.414-3-3L7.586 9l3 3-3 3L9 16.414l3-3 3 3L16.414 15l-3-3 3-3L15 7.586z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgXSquare;
