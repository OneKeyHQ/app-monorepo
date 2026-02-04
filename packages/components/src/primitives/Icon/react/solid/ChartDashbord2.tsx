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
      d="M1 4a1 1 0 0 1 1-1h20a1 1 0 1 1 0 2h-1v11a2 2 0 0 1-2 2h-5.132l.964 1.445a1 1 0 0 1-1.664 1.11L12 18.803l-1.168 1.752a1 1 0 0 1-1.664-1.11L10.132 18H5a2 2 0 0 1-2-2V5H2a1 1 0 0 1-1-1m12 4a1 1 0 1 0-2 0v5a1 1 0 1 0 2 0zm4 2a1 1 0 1 0-2 0v3a1 1 0 1 0 2 0zm-8 2a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartDashbord2;
