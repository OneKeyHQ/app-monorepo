import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAlighRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m13 7.75 3.543 3.543a1 1 0 0 1 0 1.414L13 16.25M3 12h13.25M21 5v14"
    />
  </Svg>
);
export default SvgAlighRight;
