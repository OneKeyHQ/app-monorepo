import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTextIndentRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15 6a1 1 0 0 0-1-1H3a1 1 0 0 0 0 2h11a1 1 0 0 0 1-1m6.41 2.428a1 1 0 0 0-1.073.164l-3 2.66a1 1 0 0 0 .001 1.497l3 2.65A1 1 0 0 0 22 14.65V9.34a1 1 0 0 0-.59-.912M15 12a1 1 0 0 0-1-1H3a1 1 0 1 0 0 2h11a1 1 0 0 0 1-1m0 6a1 1 0 0 0-1-1H3a1 1 0 1 0 0 2h11a1 1 0 0 0 1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTextIndentRight;
