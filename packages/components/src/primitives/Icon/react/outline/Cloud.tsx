import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCloud = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 19a5 5 0 0 1-.674-9.955A6 6 0 0 1 18 11a4 4 0 0 1 0 8H7Z"
    />
  </Svg>
);
export default SvgCloud;
