import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartDashbord2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 14H7v-3h2zm4 0h-2V7h2zm4 0h-2V9h2z" />
    <Path
      fillRule="evenodd"
      d="M23 5h-2v13h-7.133l1.519 2.277-1.664 1.11-1.723-2.584-1.722 2.584-1.664-1.11L10.132 18H3V5H1V3h22zM5 16h14V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartDashbord2;
