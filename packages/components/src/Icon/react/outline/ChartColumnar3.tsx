import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartColumnar3 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M9.33 20v-5H5a1 1 0 0 0-1 1v4h5.33Zm0 0h5.33m-5.33 0v-9.5a1 1 0 0 1 1-1h4.33V20m0 0V5a1 1 0 0 1 1-1h3.33a1 1 0 0 1 1 1v15h-5.33ZM2 20h20"
    />
  </Svg>
);
export default SvgChartColumnar3;
