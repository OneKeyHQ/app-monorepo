import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMinusLarge = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M4 12h16"
    />
  </Svg>
);
export default SvgMinusLarge;
