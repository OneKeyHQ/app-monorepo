import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartDashbord = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 11.25a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0v-1a1 1 0 0 1 1-1m4-5a1 1 0 0 1 1 1v6a1 1 0 0 1-2 0v-6a1 1 0 0 1 1-1m4 3a1 1 0 0 1 1 1v3a1 1 0 0 1-2 0v-3a1 1 0 0 1 1-1" />
    <Path
      fillRule="evenodd"
      d="M20 2.25a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3.672l.636 2.226a1.001 1.001 0 0 1-1.923.549l-.793-2.776H9.755l-.792 2.776a1.001 1.001 0 0 1-1.924-.549l.637-2.227H4a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2h16Zm-16 14h16v-12H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartDashbord;
