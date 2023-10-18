import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartDashbord = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 6a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-2.674l.636 2.225a1 1 0 1 1-1.923.55L14.246 19H9.754l-.792 2.775a1 1 0 1 1-1.924-.55L7.674 19H5a3 3 0 0 1-3-3V6Zm7 7a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0v-1Zm3-6a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm5 4a1 1 0 1 0-2 0v3a1 1 0 1 0 2 0v-3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartDashbord;
