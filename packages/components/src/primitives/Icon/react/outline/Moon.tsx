import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMoon = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 7c0-.901.15-1.768.425-2.577a7.998 7.998 0 1 0 10.15 10.15A8 8 0 0 1 9 7m2 0a6 6 0 0 0 9.4 4.944 1 1 0 0 1 1.564.907c-.434 5.123-4.728 9.145-9.962 9.145-5.522 0-9.998-4.477-9.998-9.998 0-5.234 4.021-9.528 9.144-9.962a1 1 0 0 1 .908 1.563A5.97 5.97 0 0 0 11 7" />
  </Svg>
);
export default SvgMoon;
