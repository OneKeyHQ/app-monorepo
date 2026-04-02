import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageRemove = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m22.035 15.379-2.12 2.121 2.12 2.121-1.414 1.414-2.121-2.12-2.121 2.12-1.414-1.414 2.12-2.121-2.12-2.121 1.414-1.414 2.121 2.12 2.121-2.12z" />
    <Path d="M8 9h8V3h5v7.757l-2.5 2.5-2.121-2.121-4.243 4.243 2.122 2.121-2.122 2.121L13.515 21H3V3h5z" />
    <Path d="M14 7h-4V3h4z" />
  </Svg>
);
export default SvgPackageRemove;
