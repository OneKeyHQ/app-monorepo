import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartDashbord = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 15H7v-3h2zm4 0h-2V7h2zm4 0h-2v-5h2z" />
    <Path
      fillRule="evenodd"
      d="M22 19h-5.673l.911 3.186-1.923.55L14.247 19H9.754l-1.067 3.736-1.923-.55.91-3.186H2V3h20zM4 17h16V5H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartDashbord;
