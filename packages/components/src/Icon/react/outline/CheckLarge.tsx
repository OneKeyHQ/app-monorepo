import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCheckLarge = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m3 15 6.294 5L21 4"
    />
  </Svg>
);
export default SvgCheckLarge;
