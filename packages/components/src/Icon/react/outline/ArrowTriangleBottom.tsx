import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowTriangleBottom = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17.002 5H6.998C5.515 5 4.55 6.562 5.213 7.889l5.002 10.008c.736 1.47 2.834 1.47 3.57 0l5.002-10.008C19.45 6.562 18.485 5 17.002 5Z"
    />
  </Svg>
);
export default SvgArrowTriangleBottom;
