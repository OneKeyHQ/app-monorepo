import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEyeClosed = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4.728 8.39C6.882 6.1 9.465 5 12 5s5.118 1.1 7.272 3.39a1 1 0 1 0 1.456-1.371C18.237 4.369 15.142 3 12 3S5.763 4.37 3.272 7.02a1 1 0 1 0 1.456 1.37m0 3.863a1 1 0 0 0-1.456 1.37c1.182 1.258 2.5 2.227 3.896 2.898l-1.024 1.694a1 1 0 0 0 1.712 1.034l1.214-2.01q.954.267 1.93.357V20a1 1 0 0 0 2 0v-2.404q.976-.091 1.93-.356l1.214 2.01a1 1 0 1 0 1.712-1.035l-1.024-1.694c1.395-.671 2.714-1.64 3.896-2.898a1 1 0 1 0-1.456-1.37c-2.154 2.29-4.737 3.39-7.272 3.39s-5.118-1.1-7.272-3.39" />
  </Svg>
);
export default SvgEyeClosed;
