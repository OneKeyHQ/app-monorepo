import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAr = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.121 14.948a1.5 1.5 0 0 1 1.866.087L16.376 18H21V7H3v11h4.624l3.389-2.965zM8.25 11.5a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0m9 0a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0m-7 0a2.75 2.75 0 1 1-5.5 0 2.75 2.75 0 0 1 5.5 0m9 0a2.75 2.75 0 1 1-5.5 0 2.75 2.75 0 0 1 5.5 0M23 18a2 2 0 0 1-2 2h-4.624c-.485 0-.953-.176-1.317-.495L12 16.828l-3.059 2.677A2 2 0 0 1 7.624 20H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgAr;
