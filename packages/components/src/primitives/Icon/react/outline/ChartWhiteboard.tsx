import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartWhiteboard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11 19H8.72l-1.087 3.265-1.898-.632L6.613 19H2V4h9V2h2v2h9v15h-4.613l.878 2.633-1.898.632L15.28 19H13v2h-2zm-7-2h16V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartWhiteboard;
