import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCursor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2.056}
      d="m3.69 4.964 5.39 15.362c.302.86 1.504.901 1.863.064l2.677-6.245a1 1 0 0 1 .525-.525l6.244-2.677c.838-.36.798-1.561-.063-1.863L4.964 3.69a1 1 0 0 0-1.275 1.274Z"
    />
  </Svg>
);
export default SvgCursor;
