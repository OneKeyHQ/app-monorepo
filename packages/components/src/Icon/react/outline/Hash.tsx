import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHash = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M9 4 7 20M17 4l-2 16M4 8h16m0 8H4"
    />
  </Svg>
);
export default SvgHash;
