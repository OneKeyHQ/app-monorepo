import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraCrossOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.035 8a2 2 0 0 1-1.664-.89L13.965 5h-3.93L8.63 7.11A2 2 0 0 1 6.965 8H4v11h16V8zm-3.74 2.793a1 1 0 0 1 1.414 1.414l-1.295 1.295 1.293 1.293a1 1 0 0 1-1.414 1.414L12 14.916l-1.293 1.293a1 1 0 0 1-1.414-1.414l1.293-1.293-1.295-1.295a1 1 0 0 1 1.414-1.414L12 12.088zM22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.965L8.37 3.89A2 2 0 0 1 10.035 3h3.93a2 2 0 0 1 1.664.89L17.035 6H20a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgCameraCrossOff;
