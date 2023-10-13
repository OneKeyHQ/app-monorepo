import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAlignmentCenter = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 5h16M8 12h8M4 19h16"
    />
  </Svg>
);
export default SvgAlignmentCenter;
