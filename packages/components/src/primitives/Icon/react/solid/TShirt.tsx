import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTShirt = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M23.241 6.535 22.001 11l-3-.972V21h-14V10.028l-3 .972-1.24-4.465L9.002 3c1.006 3.143 4.994 3.143 6 0l8.24 3.535Z" />
  </Svg>
);
export default SvgTShirt;
