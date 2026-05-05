import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWindowsHello = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19.168 15.028a1 1 0 0 1 1.664 1.11c-.915 1.371-2.219 2.493-3.767 3.267A11.36 11.36 0 0 1 12 20.583c-1.771 0-3.518-.403-5.065-1.177s-2.852-1.897-3.767-3.268a1 1 0 0 1 1.664-1.11c.708 1.061 1.737 1.959 2.997 2.59s2.7.965 4.17.965a9.35 9.35 0 0 0 4.172-.966c1.26-.63 2.29-1.528 2.997-2.589M6.5 4a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5m11 0a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5" />
  </Svg>
);
export default SvgWindowsHello;
