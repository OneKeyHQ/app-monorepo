import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGiftcard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 13h-3.586l1.293 1.293a1 1 0 1 1-1.414 1.414L15 14.414V18h5zm-7 5v-3.586l-1.293 1.293a1 1 0 1 1-1.414-1.414L11.586 13H4v5zm2-12v3.586l1.293-1.293a1 1 0 1 1 1.414 1.414L16.414 11H20V6zM4 11h7.586l-1.293-1.293a1 1 0 1 1 1.414-1.414L13 9.586V6H4zm18 7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgGiftcard;
