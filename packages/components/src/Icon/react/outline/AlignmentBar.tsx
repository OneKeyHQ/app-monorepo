import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAlignmentBar = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 5v14M9 6h12M9 12h12M9 18h7"
    />
  </Svg>
);
export default SvgAlignmentBar;
