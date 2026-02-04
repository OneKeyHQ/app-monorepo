import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPiano = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.5 5v8a1 1 0 0 1-1 1H16v6h3V5zm-6 8a1 1 0 0 1-1 1H10v6h4v-6h-.5a1 1 0 0 1-1-1V5h-1zm3-1h1V5h-1zm-6 0h1V5h-1zM5 20h3v-6h-.5a1 1 0 0 1-1-1V5H5zm16 0a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgPiano;
