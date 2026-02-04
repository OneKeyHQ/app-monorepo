import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowPathUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.01 9.908c0-.555.45-1.005 1.005-1.005h2.296l-5.312-6.019-5.31 6.019h2.295c.555 0 1.005.45 1.005 1.005v10.051h4.02V9.909Zm2.01 10.051c0 1.11-.9 2.01-2.01 2.01H9.99c-1.11 0-2.01-.9-2.01-2.01v-9.046H5.574c-1.298 0-1.99-1.531-1.13-2.505l6.048-6.854a2.01 2.01 0 0 1 3.014 0l6.048 6.854c.86.974.168 2.505-1.13 2.505H16.02z" />
  </Svg>
);
export default SvgArrowPathUp;
