import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCodeBrackets = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m10 20 4-16m4 4 2.586 2.586a2 2 0 0 1 0 2.828L18 16M6 16l-2.586-2.586a2 2 0 0 1 0-2.828L6 8"
    />
  </Svg>
);
export default SvgCodeBrackets;
