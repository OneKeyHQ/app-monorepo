import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDrop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m12.618 2.214.002.002.006.004.018.014a11 11 0 0 1 .3.248 29 29 0 0 1 3.318 3.309C18.04 7.884 20 10.87 20 14a8 8 0 1 1-16 0c0-3.128 1.961-6.116 3.737-8.21a29 29 0 0 1 3.319-3.308 18 18 0 0 1 .3-.248l.018-.014.006-.004.002-.002.618-.486z" />
  </Svg>
);
export default SvgDrop;
