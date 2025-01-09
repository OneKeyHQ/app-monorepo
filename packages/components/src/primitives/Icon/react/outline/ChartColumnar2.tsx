import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartColumnar2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9.33 20v-6H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h4.33Zm0 0h5.33m-5.33 0V5a1 1 0 0 1 1-1h3.33a1 1 0 0 1 1 1v15m0 0V9h4.33a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-4.33Z"
    />
  </Svg>
);
export default SvgChartColumnar2;
