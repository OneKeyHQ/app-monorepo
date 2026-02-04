import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2.293 2.293a1 1 0 0 1 1.414 0l18 18a1 1 0 1 1-1.414 1.414L19.586 21H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h.586L2.293 3.707a1 1 0 0 1 0-1.414M20 15V8h-2.965a2 2 0 0 1-1.592-.79l-.072-.1L13.965 5H9.5a1 1 0 1 1 0-2h4.465a2 2 0 0 1 1.664.89L17.035 6H20a2 2 0 0 1 2 2v7a1 1 0 1 1-2 0m-10-2a2 2 0 0 0 3.191 1.605l-2.797-2.797A2 2 0 0 0 10 13m-6 6h13.586l-2.974-2.974C13.912 16.631 13 17 12 17a4 4 0 0 1-3.027-6.613L6.586 8H4z" />
  </Svg>
);
export default SvgCameraOff;
