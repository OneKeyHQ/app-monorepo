import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCoinsAdd = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 14a5 5 0 1 0-10 0 5 5 0 0 0 10 0m-6 2v-1h-1a1 1 0 1 1 0-2h1v-1a1 1 0 1 1 2 0v1h1a1 1 0 1 1 0 2h-1v1a1 1 0 1 1-2 0m8-2a7 7 0 0 1-13.33 2.991 7 7 0 1 1 6.658-9.983A7 7 0 0 1 22 14M4 10a5 5 0 0 0 4.059 4.91 7 7 0 0 1 5.11-7.667A4.99 4.99 0 0 0 8.999 5a5 5 0 0 0-5 5Z" />
  </Svg>
);
export default SvgCoinsAdd;
