import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEmail2Notification = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14 6H4v2.486A13.93 13.93 0 0 0 12.002 11c1.294 0 2.546-.175 3.733-.503l.532 1.928c-1.36.375-2.79.575-4.265.575-2.914 0-5.647-.783-8.002-2.146V18h16v-6h2v8H2V4h12z" />
    <Path
      fillRule="evenodd"
      d="M20 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEmail2Notification;
