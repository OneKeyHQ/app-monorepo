import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWifi = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 17.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m0 .75a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1"
      clipRule="evenodd"
    />
    <Path d="M6.136 12.525c3.423-2.67 8.306-2.67 11.73 0l-1.231 1.577c-2.7-2.105-6.569-2.105-9.269 0zM2.385 7.283c5.61-4.379 13.62-4.379 19.23 0l-1.23 1.577c-4.888-3.814-11.882-3.814-16.77 0z" />
  </Svg>
);
export default SvgWifi;
