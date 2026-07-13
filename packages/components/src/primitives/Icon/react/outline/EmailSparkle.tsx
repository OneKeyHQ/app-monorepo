import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEmailSparkle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m19.4 14 1 2.6 2.6 1v.8l-2.6 1-1 2.6h-.8l-1-2.6-2.6-1v-.8l2.6-1 1-2.6z" />
    <Path
      fillRule="evenodd"
      d="M22 12h-2V7.568l-8 5.658-8-5.658V18h9v2H2V4h20zm-10-1.225L18.754 6H5.246z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEmailSparkle;
