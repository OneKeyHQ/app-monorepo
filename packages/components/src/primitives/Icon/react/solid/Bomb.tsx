import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBomb = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18.414 7 16.32 9.095a8 8 0 1 1-1.415-1.415L17 5.586zM23 6v2h-3V6zm-.586-3L20 5.414 18.586 4 21 1.586zM18 4h-2V1h2z" />
  </Svg>
);
export default SvgBomb;
