import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWindowsHello = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 6.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0m11.555 8.251a1 1 0 0 1 .277 1.387c-.915 1.372-2.219 2.494-3.767 3.268A11.36 11.36 0 0 1 12 20.583c-1.771 0-3.517-.403-5.065-1.177s-2.852-1.896-3.767-3.268a1 1 0 1 1 1.664-1.11c.708 1.061 1.737 1.959 2.997 2.589 1.261.63 2.7.966 4.171.966s2.91-.336 4.17-.966c1.261-.63 2.29-1.528 2.998-2.589a1 1 0 0 1 1.387-.277M17.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5" />
  </Svg>
);
export default SvgWindowsHello;
