import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBadgeVerified = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10.586 2a2 2 0 0 1 2.828 0l2 2H18a2 2 0 0 1 2 2v2.586l2 2a2 2 0 0 1 0 2.828l-2 2V18a2 2 0 0 1-2 2h-2.586l-2 2a2 2 0 0 1-2.828 0l-2-2H6a2 2 0 0 1-2-2v-2.586l-2-2a2 2 0 0 1 0-2.828l2-2V6a2 2 0 0 1 2-2h2.586zm4.733 8.323a1 1 0 1 0-1.638-1.147l-2.861 4.088-1.162-1.017a1 1 0 1 0-1.317 1.505l2 1.75a1 1 0 0 0 1.478-.179z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBadgeVerified;
