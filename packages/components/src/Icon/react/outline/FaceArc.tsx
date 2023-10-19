import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFaceArc = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 15.25c2 1 4 1 6 0M10 8v3m4-3v3m7 1a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  </Svg>
);
export default SvgFaceArc;
