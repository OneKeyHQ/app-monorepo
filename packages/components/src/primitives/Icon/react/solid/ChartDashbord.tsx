import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartDashbord = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 19h-5.674l.91 3.186-1.923.55L14.246 19H9.754l-1.067 3.736-1.923-.55.91-3.186H2V3h20zM7 15h2v-3H7zm4-8v8h2V7zm4 8h2v-5h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartDashbord;
