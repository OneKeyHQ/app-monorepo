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
      d="M21 21H3V3h18zM5 19h2v-2H5zm12 0h2v-1.556h-2zm0-3.556h2V13h-2zM5 15h2v-2H5zm4-2h6v-2H9zm-4-2h2V9H5zm12 0h2V9h-2zM5 7h2V5H5zm12 0h2V5h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgVideoClip;
