import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOfficeBuilding = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.727 9.727v8.182h3.637V9.727zm-4.545 2.727a.91.91 0 1 1 0 1.819H8.364a.91.91 0 1 1 0-1.819zm0-3.636a.91.91 0 1 1 0 1.818H8.364a.91.91 0 1 1 0-1.818zM5.636 6.091v11.818h7.273V6.091zm9.091 1.818h3.637c1.004 0 1.818.814 1.818 1.818v8.182h.909a.91.91 0 1 1 0 1.818H2.909a.91.91 0 0 1 0-1.818h.91V6.091c0-1.004.813-1.818 1.817-1.818h7.273c1.004 0 1.818.814 1.818 1.818z" />
  </Svg>
);
export default SvgOfficeBuilding;
