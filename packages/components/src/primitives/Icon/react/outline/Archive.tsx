import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArchive = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM5 19h14v-5h-2.363c-.71 1.848-2.673 3-4.637 3s-3.928-1.152-4.637-3H5zm0-7h3.981l.133.846C9.297 14.009 10.521 15 12 15s2.703-.99 2.886-2.154l.133-.846H19V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArchive;
