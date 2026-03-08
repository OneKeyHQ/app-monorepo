import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloudOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m21.707 20.293-1.414 1.414-1.737-1.737Q18.281 20 18 20H7A6 6 0 0 1 5.599 8.165a7 7 0 0 1 .393-.759L1.586 3 3 1.586zM12 4a7 7 0 0 1 6.941 6.089 5 5 0 0 1 3.162 7.77L8.942 4.701A7 7 0 0 1 12 4" />
  </Svg>
);
export default SvgCloudOff;
