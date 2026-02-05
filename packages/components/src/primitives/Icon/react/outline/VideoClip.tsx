import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVideoClip = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 17.444h-2V19h2zM9 19h6v-6H9zm8-3.556h2V13h-2zM5 15h2v-2H5zm12-4h2V9h-2zm-8 0h6V5H9zm-4 0h2V9H5zm2 8v-2H5v2zM17 5v2h2V5zM5 7h2V5H5zm16 12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgVideoClip;
