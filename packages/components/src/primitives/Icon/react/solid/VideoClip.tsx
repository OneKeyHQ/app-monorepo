import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVideoClip = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm4 0H5v2h2zm10 0v2h2V5zm2 4h-2v2h2zm0 4h-2v2.444h2zm0 4.444h-2V19h2zM15 13v-2H9v2zm-8 6v-2H5v2zm-2-4h2v-2H5zm0-4h2V9H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgVideoClip;
