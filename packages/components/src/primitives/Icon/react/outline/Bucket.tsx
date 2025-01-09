import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBucket = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m4.497 7.998 1.284 10.25A2 2 0 0 0 7.765 20h8.47a2 2 0 0 0 1.984-1.751l1.284-10.25H4.497Z"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 4h18v4H3V4Z"
    />
  </Svg>
);
export default SvgBucket;
