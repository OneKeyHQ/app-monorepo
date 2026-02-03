import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWhisper = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m2 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2" />
    <Path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a1 1 0 1 1-2 0V6H4v12h6a1 1 0 1 1 0 2H4a2 2 0 0 1-2-2z" />
    <Path d="M18 11a1 1 0 0 1 1 1c0 1.267.282 1.95.665 2.335.384.383 1.068.665 2.335.665a1 1 0 1 1 0 2c-1.267 0-1.95.282-2.335.665C19.282 18.05 19 18.733 19 20a1 1 0 1 1-2 0c0-1.267-.282-1.95-.665-2.335C15.95 17.282 15.267 17 14 17a1 1 0 1 1 0-2c1.267 0 1.95-.282 2.335-.665.383-.384.665-1.068.665-2.335a1 1 0 0 1 1-1" />
  </Svg>
);
export default SvgWhisper;
