import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBezierCurve = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M11 4a2 2 0 0 0-2 2H4.732a2 2 0 1 0 0 2h1.61a8.985 8.985 0 0 0-3.287 6H3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-1.93-1.999A7.009 7.009 0 0 1 9.1 8.627 2 2 0 0 0 11 10h2c.886 0 1.637-.576 1.9-1.373A7.009 7.009 0 0 1 18.93 14 2 2 0 0 0 17 16v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-.055a8.985 8.985 0 0 0-3.288-6h1.61A2 2 0 0 0 23 7a2 2 0 0 0-3.732-1H15a2 2 0 0 0-2-2h-2Z"
    />
  </Svg>
);
export default SvgBezierCurve;
