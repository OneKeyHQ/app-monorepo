import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageText = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M19.002 3h-14a2 2 0 0 0-2 2v12.036a2 2 0 0 0 2 2h3.65l2.704 2.266a1 1 0 0 0 1.28.004l2.74-2.27h3.626a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2M8 9a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1m1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageText;
