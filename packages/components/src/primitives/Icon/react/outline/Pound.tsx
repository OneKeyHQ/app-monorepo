import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPound = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14.247 7.712A2.5 2.5 0 0 0 10 9.5c0 1.086.619 1.856.883 2.5M14 16H9l2-3.5c0-.16-.046-.325-.117-.5m0 0H9m1.883 0H14m7 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  </Svg>
);
export default SvgPound;
