import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTrezor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M16.872 6.641C16.872 4.104 14.675 2 11.999 2S7.126 4.106 7.126 6.641v1.483H5.121v10.671L11.998 22l6.881-3.205V8.171h-2.006zm-7.261 0c0-1.196 1.051-2.154 2.389-2.154s2.389.957 2.389 2.154v1.483H9.61zm6.497 10.43-4.11 1.916-4.109-1.914V10.66h8.219z"
    />
  </Svg>
);
export default SvgTrezor;
