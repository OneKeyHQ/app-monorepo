import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowTriangleRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 17.002V6.998C5 5.515 6.562 4.55 7.889 5.213l10.008 5.002c1.47.736 1.47 2.834 0 3.57L7.889 18.787C6.562 19.45 5 18.485 5 17.002Z"
    />
  </Svg>
);
export default SvgArrowTriangleRight;
