import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMagicHands = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 5a7 7 0 0 0-6.254 3.852A1 1 0 1 1 3.96 7.95 9 9 0 0 1 12 3a9 9 0 0 1 8.04 4.95 1 1 0 0 1-1.786.902A7 7 0 0 0 12 5"
    />
    <Path
      fill="currentColor"
      d="M12 8c-1.459 0-2.736.78-3.436 1.951a1 1 0 1 1-1.717-1.026A6 6 0 0 1 12 6a6 6 0 0 1 5.153 2.925 1 1 0 1 1-1.717 1.026A4 4 0 0 0 12 8m-8.244 3.528a3.25 3.25 0 0 0-1.942 4.165l.598 1.645a4 4 0 0 0 7.518-2.736l-.086-.235a1.75 1.75 0 0 0-2.01-1.113 3.25 3.25 0 0 0-4.078-1.726m16.488 0a3.25 3.25 0 0 1 1.942 4.165l-.598 1.645a4 4 0 0 1-7.518-2.736l.086-.235a1.75 1.75 0 0 1 2.01-1.113 3.25 3.25 0 0 1 4.078-1.726"
    />
  </Svg>
);
export default SvgMagicHands;
