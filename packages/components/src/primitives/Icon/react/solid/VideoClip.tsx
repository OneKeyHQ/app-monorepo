import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVideoClip = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm3-1a1 1 0 0 0-1 1v1h2V5zm11 0v2h2V6a1 1 0 0 0-1-1zm2 4h-2v2h2zm0 4h-2v2.444h2zm0 4.444h-2V19h1a1 1 0 0 0 1-1zM15 13v-2H9v2zm-8 6v-2H5v1a1 1 0 0 0 1 1zm-2-4h2v-2H5zm0-4h2V9H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgVideoClip;
