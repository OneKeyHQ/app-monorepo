import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGiftcard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 4H4a2 2 0 0 0-2 2v5h9.586l-1.293-1.293a1 1 0 1 1 1.414-1.414L13 9.586zM2 13v5a2 2 0 0 0 2 2h9v-5.586l-1.293 1.293a1 1 0 0 1-1.414-1.414L11.586 13zm13 7h5a2 2 0 0 0 2-2v-5h-5.586l1.293 1.293a1 1 0 0 1-1.414 1.414L15 14.414zm7-9V6a2 2 0 0 0-2-2h-5v5.586l1.293-1.293a1 1 0 1 1 1.414 1.414L16.414 11z" />
  </Svg>
);
export default SvgGiftcard;
