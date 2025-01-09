import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowTopRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6.5 17.5 17.25 6.75M18 15V8a2 2 0 0 0-2-2H9"
    />
  </Svg>
);
export default SvgArrowTopRight;
