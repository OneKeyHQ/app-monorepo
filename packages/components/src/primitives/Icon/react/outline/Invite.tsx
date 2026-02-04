import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgInvite = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.633 14.844c-.41.137-.855.137-1.266 0L4 12.388V19h16v-6.612zM14 7a1 1 0 1 1 0 2h-4a1 1 0 0 1 0-2zM6 4v6.945l6 2.001 6-2V4zm14 6.389a2 2 0 0 1 2 1.999V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6.612a2 2 0 0 1 2-2V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgInvite;
