import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAiText = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 9a1 1 0 0 1 .919.606l1.342 3.132 3.133 1.343a1 1 0 0 1 0 1.838L19.26 17.26l-1.342 3.133a1 1 0 0 1-1.838 0l-1.343-3.133-3.132-1.342a1 1 0 0 1 0-1.838l3.132-1.343 1.343-3.132.068-.131A1 1 0 0 1 17 9M7 17a1 1 0 1 1 0 2H4a1 1 0 1 1 0-2zm9.419-3.106a1 1 0 0 1-.525.525L14.537 15l1.357.581.086.042a1 1 0 0 1 .439.483L17 17.462l.581-1.356.042-.087a1 1 0 0 1 .483-.438L19.462 15l-1.356-.581a1 1 0 0 1-.525-.525L17 12.537zM9 11a1 1 0 1 1 0 2H4a1 1 0 1 1 0-2zm11-6a1 1 0 1 1 0 2H4a1 1 0 0 1 0-2z" />
  </Svg>
);
export default SvgAiText;
