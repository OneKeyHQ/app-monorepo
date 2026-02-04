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
      d="M2 4.25a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3.674l.636 2.225a1 1 0 1 1-1.923.55l-.793-2.775H9.754l-.792 2.775a1 1 0 1 1-1.924-.55l.636-2.225H4a2 2 0 0 1-2-2zm7 8a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0zm3-6a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1m5 4a1 1 0 1 0-2 0v3a1 1 0 1 0 2 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartDashbord;
