import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgText = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4h8m8 0h-8m0 0v16"
    />
  </Svg>
);
export default SvgText;
