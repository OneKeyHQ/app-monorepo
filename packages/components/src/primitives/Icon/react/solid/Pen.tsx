import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18.241 13.543a2 2 0 0 0 2.514-.256l1.086-1.086a2 2 0 0 0 0-2.829l-7.071-7.07a2 2 0 0 0-2.829 0l-1.085 1.085a2 2 0 0 0-.265 2.501L4.356 8.761a2 2 0 0 0-1.148 1.568L1.891 20.837 7.91 14.82a2.002 2.002 0 0 1 1.932-2.518 2 2 0 1 1-.518 3.932l-6.015 6.014 10.453-1.384a2 2 0 0 0 1.545-1.126l2.935-6.194Zm1.1-1.67L12.27 4.8l1.086-1.085 7.07 7.07-1.085 1.086Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPen;
