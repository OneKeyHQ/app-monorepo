import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSwitch = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeWidth={2}
      d="M2 12a6 6 0 0 1 6-6h8a6 6 0 0 1 0 12H8a6 6 0 0 1-6-6Z"
    />
    <Path
      stroke="currentColor"
      strokeWidth={2}
      d="M13 12a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z"
    />
  </Svg>
);
export default SvgSwitch;
