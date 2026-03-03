import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderOpen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12.535 6H21v4h2.11l-3.125 10H2V3h8.535zM4 18h.765l2.5-8H19V8h-7.535l-2-3H4zm2.86 0h11.656l1.875-6H8.734z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolderOpen;
