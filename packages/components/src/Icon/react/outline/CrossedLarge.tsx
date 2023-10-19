import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCrossedLarge = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="m5 5 14 14m0-14L5 19"
    />
  </Svg>
);
export default SvgCrossedLarge;
