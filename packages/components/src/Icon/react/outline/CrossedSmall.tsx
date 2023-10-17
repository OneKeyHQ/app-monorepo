import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCrossedSmall = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="m8 8 8 8m0-8-8 8"
    />
  </Svg>
);
export default SvgCrossedSmall;
