import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgYen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 8.481L8.594 6.59 7.089 7.906 10.67 12H9v2h2v4h2v-4h2v-2h-1.67l3.581-4.094-1.505-1.317z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgYen;
