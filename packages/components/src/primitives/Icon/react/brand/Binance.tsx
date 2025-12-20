import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBinance = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m7.73 10.244 4.272-4.27 4.275 4.274 2.485-2.487L12.002 1l-6.76 6.76zM1 12l2.486-2.485 2.485 2.486-2.485 2.485zM7.73 13.756l4.272 4.273 4.275-4.274 2.486 2.483L12.003 23l-6.764-6.762zM18.029 12.001l2.485-2.485L23 12l-2.486 2.486z" />
    <Path d="m14.524 12-2.522-2.524-1.864 1.865-.216.214-.445.444.004.006 2.521 2.52 2.523-2.526z" />
  </Svg>
);
export default SvgBinance;
