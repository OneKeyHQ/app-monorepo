import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileCloud = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6.25 13.5c1.318 0 2.494.6 3.272 1.54A3.5 3.5 0 0 1 9 22H6.25a4.25 4.25 0 0 1 0-8.5" />
    <Path d="M12 10h8v12h-6.757a5.5 5.5 0 0 0-2.683-8.774A6.23 6.23 0 0 0 6.25 11.5c-.793 0-1.552.148-2.25.417V2h8z" />
    <Path d="M19.414 8H14V2.586z" />
  </Svg>
);
export default SvgFileCloud;
