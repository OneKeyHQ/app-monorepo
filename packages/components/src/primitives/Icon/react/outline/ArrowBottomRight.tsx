import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowBottomRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m6.5 6.5 10.75 10.75M9 18h7a2 2 0 0 0 2-2V9"
    />
  </Svg>
);
export default SvgArrowBottomRight;
