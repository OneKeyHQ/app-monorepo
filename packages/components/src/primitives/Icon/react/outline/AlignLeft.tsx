import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAlignLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m11 7.75-3.543 3.543a1 1 0 0 0 0 1.414L11 16.25M21 12H7.75M3 5v14"
    />
  </Svg>
);
export default SvgAlignLeft;
