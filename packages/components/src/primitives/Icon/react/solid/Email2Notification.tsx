import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEmail2Notification = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 9.491A15.93 15.93 0 0 0 12 13c2.214 0 4.322-.45 6.24-1.263.556.17 1.148.263 1.76.263a6 6 0 0 0 2-.342V20H2z" />
    <Path d="M14.342 4A6 6 0 0 0 14 6c0 1.756.755 3.335 1.957 4.433A14 14 0 0 1 12 11 13.96 13.96 0 0 1 2 6.798V4z" />
    <Path
      fillRule="evenodd"
      d="M20 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEmail2Notification;
