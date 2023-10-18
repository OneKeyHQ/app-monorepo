import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartColumnar = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M16.34 4.501a1.5 1.5 0 0 1 1.5-1.5h1.67a1.5 1.5 0 0 1 1.5 1.5v15a1.5 1.5 0 0 1-1.5 1.5h-1.67a1.5 1.5 0 0 1-1.5-1.5v-15Zm-5.17 4a1.5 1.5 0 0 0-1.5 1.5v9.5a1.5 1.5 0 0 0 1.5 1.5h1.67a1.5 1.5 0 0 0 1.5-1.5v-9.5a1.5 1.5 0 0 0-1.5-1.5h-1.67Zm-6.67 5.5a1.5 1.5 0 0 0-1.5 1.5v4a1.5 1.5 0 0 0 1.5 1.5h1.67a1.5 1.5 0 0 0 1.5-1.5v-4a1.5 1.5 0 0 0-1.5-1.5H4.5Z"
    />
  </Svg>
);
export default SvgChartColumnar;
