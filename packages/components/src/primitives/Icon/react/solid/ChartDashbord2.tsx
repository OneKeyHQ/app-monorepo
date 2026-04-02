import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartDashbord2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M23 5h-2v13h-7.132l1.519 2.277-1.664 1.11L12 18.803l-1.723 2.584-1.664-1.11L10.132 18H3V5H1V3h22zM7 14h2v-3H7zm4-7v7h2V7zm4 7h2V9h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartDashbord2;
