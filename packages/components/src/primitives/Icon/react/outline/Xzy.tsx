import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgXzy = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20 15H9m0 0-5 5m5-5V5M6 7l3-3 3 3"
    />
  </Svg>
);
export default SvgXzy;
