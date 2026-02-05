import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPrinter = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 15H8v5h8zm-7-5a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2zM4 8v8h2v-2a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2h2V8zm4-4v2h8V4zm10 2h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgPrinter;
