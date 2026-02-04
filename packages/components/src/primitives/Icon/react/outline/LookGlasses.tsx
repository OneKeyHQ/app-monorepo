import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLookGlasses = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0m12 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0m2 0a5 5 0 1 1-9.702-1.704A3 3 0 0 0 12 10c-.466 0-.906.106-1.299.295a5 5 0 1 1-9.6.705H1a1 1 0 1 1 0-2h1a5 5 0 0 1 4-2c1.442 0 2.74.61 3.652 1.587a4.98 4.98 0 0 1 4.695 0A4.99 4.99 0 0 1 18 7c1.636 0 3.088.786 4 2h1a1 1 0 1 1 0 2h-.1q.099.486.1 1" />
  </Svg>
);
export default SvgLookGlasses;
