import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowTriangleTop = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17.002 19H6.998c-1.483 0-2.448-1.561-1.785-2.889l5.002-10.008c.736-1.47 2.834-1.47 3.57 0l5.002 10.008C19.45 17.44 18.485 19 17.002 19Z"
    />
  </Svg>
);
export default SvgArrowTriangleTop;
