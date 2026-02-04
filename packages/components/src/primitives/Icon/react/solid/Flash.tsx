import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFlash = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16.089 3.345c.6-1.86-1.786-3.358-3.146-1.79L4.132 11.712c-1.026 1.182-.215 3.072 1.39 3.072h4.29l-1.897 5.87c-.6 1.86 1.786 3.359 3.146 1.79l8.811-10.156c1.026-1.182.215-3.072-1.39-3.072h-4.29z" />
  </Svg>
);
export default SvgFlash;
