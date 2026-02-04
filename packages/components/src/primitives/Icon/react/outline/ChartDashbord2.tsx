import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartDashbord2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 11a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0v-1a1 1 0 0 1 1-1m4-4a1 1 0 0 1 1 1v5a1 1 0 0 1-2 0V8a1 1 0 0 1 1-1m4 2a1 1 0 0 1 1 1v3a1 1 0 0 1-2 0v-3a1 1 0 0 1 1-1" />
    <Path
      fillRule="evenodd"
      d="M22 3a1 1 0 1 1 0 2h-1v11a2 2 0 0 1-2 2h-5.133l.964 1.445a1 1 0 0 1-1.664 1.11l-1.168-1.751-1.167 1.75a1 1 0 1 1-1.664-1.109L10.132 18H5a2 2 0 0 1-2-2V5H2a1 1 0 1 1 0-2zM5 16h14V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartDashbord2;
