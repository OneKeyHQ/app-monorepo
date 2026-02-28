import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWhisper = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 11c0 1.614.358 2.548.905 3.095S21.386 15 23 15v2c-1.614 0-2.548.358-3.095.905S19 19.386 19 21h-2c0-1.614-.358-2.548-.905-3.095S14.614 17 13 17v-2c1.614 0 2.548-.358 3.095-.905S17 12.614 17 11z" />
    <Path d="M22 9h-2V6H4v12h7v2H2V4h20z" />
    <Path d="M6 7a1 1 0 1 1 0 2 1 1 0 0 1 0-2m3 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2m3 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2" />
  </Svg>
);
export default SvgWhisper;
