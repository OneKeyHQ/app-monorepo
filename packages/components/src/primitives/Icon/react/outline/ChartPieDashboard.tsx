import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartPieDashboard = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 3a9 9 0 1 0 8.488 12M12 3a9 9 0 0 1 8.488 12M12 3v9l8.488 3"
    />
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeOpacity={0.2}
      strokeWidth={2}
      d="M12 3a9 9 0 1 0 8.488 12M12 3a9 9 0 0 1 8.488 12M12 3v9l8.488 3"
    />
  </Svg>
);
export default SvgChartPieDashboard;
