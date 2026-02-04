import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEye = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 4.092c4.048 0 7.972 2.411 10.505 6.974.322.578.322 1.29 0 1.868-2.533 4.563-6.457 6.974-10.505 6.974s-7.972-2.411-10.505-6.974a1.93 1.93 0 0 1 0-1.868C4.028 6.503 7.952 4.092 12 4.092m0 1.977C8.807 6.07 5.49 7.96 3.237 12c2.252 4.04 5.57 5.93 8.763 5.93s6.509-1.891 8.761-5.931C18.51 7.96 15.193 6.069 12 6.069M13.977 12a1.977 1.977 0 1 0-3.954 0 1.977 1.977 0 0 0 3.954 0m1.977 0a3.954 3.954 0 1 1-7.908 0 3.954 3.954 0 0 1 7.908 0" />
  </Svg>
);
export default SvgEye;
