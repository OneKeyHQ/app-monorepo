import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartLine2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5 4a1 1 0 0 0-2 0v14a3 3 0 0 0 3 3h15a1 1 0 1 0 0-2H6a1 1 0 0 1-1-1V4Z"
    />
    <Path
      fill="currentColor"
      d="M15 5a1 1 0 1 0-2 0v11a1 1 0 1 0 2 0V5Zm-5 6a1 1 0 1 0-2 0v5a1 1 0 1 0 2 0v-5Zm10 2a1 1 0 1 0-2 0v3a1 1 0 1 0 2 0v-3Z"
    />
  </Svg>
);
export default SvgChartLine2;
