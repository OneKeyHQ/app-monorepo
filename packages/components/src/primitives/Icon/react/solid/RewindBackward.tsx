import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRewindBackward = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m19.999 20-8-6v6L1.332 12l10.667-8v6l8-6z" />
  </Svg>
);
export default SvgRewindBackward;
