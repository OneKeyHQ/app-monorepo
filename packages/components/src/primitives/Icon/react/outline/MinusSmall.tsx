import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMinusSmall = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M7 12h10"
    />
  </Svg>
);
export default SvgMinusSmall;
