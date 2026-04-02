import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDrop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m12.618 2.214.002.002.006.004.018.014a11 11 0 0 1 .3.248 29 29 0 0 1 3.318 3.308C18.04 7.884 20 10.872 20 14a8 8 0 1 1-16 0c0-3.128 1.96-6.116 3.737-8.21a29 29 0 0 1 3.319-3.308 18 18 0 0 1 .3-.248l.018-.014.006-.004.002-.002.618-.485zm-1.036 2.469a27 27 0 0 0-2.32 2.402C7.54 9.116 6 11.628 6 14a6 6 0 0 0 12 0c0-2.372-1.54-4.884-3.263-6.915A27 27 0 0 0 12 4.307q-.188.165-.418.376"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDrop;
