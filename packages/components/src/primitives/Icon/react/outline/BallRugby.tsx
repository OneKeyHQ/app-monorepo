import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBallRugby = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.414 4 20 8.586V4zm-2.61.219a11.01 11.01 0 0 0-8.585 8.586l6.975 6.975a11.01 11.01 0 0 0 8.586-8.586zm.239 5.324a1 1 0 1 1 1.414 1.414l-3.5 3.5a1 1 0 1 1-1.414-1.414zM8.586 20 4 15.414V20zM22 9q0 1.026-.154 2.01A13.01 13.01 0 0 1 11.01 21.847 13 13 0 0 1 9 22H4a2 2 0 0 1-2-2v-5q0-1.026.154-2.01A13.01 13.01 0 0 1 12.99 2.153 13 13 0 0 1 15 2h5a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgBallRugby;
