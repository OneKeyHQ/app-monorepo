import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageLike = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M19.002 3h-14a2 2 0 0 0-2 2v12.036a2 2 0 0 0 2 2h3.65l2.704 2.266a1 1 0 0 0 1.28.004l2.74-2.27h3.626a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2M12 14.28c.27 0 3.25-1.535 3.25-3.612 0-1.445-.902-2.168-1.805-2.168-.904 0-1.445.542-1.445.542s-.542-.542-1.445-.542c-.904 0-1.807.723-1.807 2.168 0 2.077 2.98 3.612 3.252 3.612"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageLike;
