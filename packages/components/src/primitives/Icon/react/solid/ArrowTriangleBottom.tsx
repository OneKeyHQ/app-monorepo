import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowTriangleBottom = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M4.319 8.336C3.323 6.344 4.77 4 6.998 4h10.004c2.227 0 3.675 2.344 2.68 4.336l-5.003 10.008c-1.104 2.208-4.254 2.208-5.358 0L4.319 8.336Z"
    />
  </Svg>
);
export default SvgArrowTriangleBottom;
