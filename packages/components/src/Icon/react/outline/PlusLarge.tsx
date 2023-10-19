import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPlusLarge = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M12 4v8m0 0v8m0-8H4m8 0h8"
    />
  </Svg>
);
export default SvgPlusLarge;
