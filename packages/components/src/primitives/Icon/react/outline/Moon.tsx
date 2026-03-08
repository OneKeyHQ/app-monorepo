import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMoon = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11.481 3.445A7 7 0 0 0 11.001 6a7 7 0 0 0 9.555 6.52l1.631-.641-.279 1.73c-.771 4.776-4.911 8.423-9.905 8.423-5.542 0-10.034-4.492-10.034-10.034 0-4.994 3.647-9.134 8.423-9.905l1.73-.28zM9.13 4.495a8.034 8.034 0 1 0 10.377 10.376A9 9 0 0 1 9.129 4.495Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMoon;
