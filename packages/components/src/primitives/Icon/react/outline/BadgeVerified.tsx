import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBadgeVerified = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.414 6A2 2 0 0 1 14 5.414l-2-2-2 2A2 2 0 0 1 8.586 6H6v2.586A2 2 0 0 1 5.414 10l-2 2 2 2 .133.147A2 2 0 0 1 6 15.414V18h2.586a2 2 0 0 1 1.414.586l2 2 2-2A2 2 0 0 1 15.414 18H18v-2.586A2 2 0 0 1 18.586 14l2-2-2-2A2 2 0 0 1 18 8.586V6zM20 8.586l2 2a2 2 0 0 1 .137 2.677l-.137.151-2 2V18a2 2 0 0 1-2 2h-2.586l-2 2a2 2 0 0 1-2.828 0l-2-2H6a2 2 0 0 1-2-2v-2.586l-2-2a2 2 0 0 1 0-2.828l2-2V6a2 2 0 0 1 2-2h2.586l2-2a2 2 0 0 1 2.828 0l2 2H18a2 2 0 0 1 2 2z" />
    <Path d="M13.68 9.177a1 1 0 0 1 1.64 1.146l-3.5 5a1 1 0 0 1-1.478.18l-2-1.75a1 1 0 0 1 1.316-1.506l1.161 1.016z" />
  </Svg>
);
export default SvgBadgeVerified;
