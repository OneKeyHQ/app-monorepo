import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgUnlocked = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2a5 5 0 0 1 5 5h-2a3 3 0 1 0-6 0v2h11v13H4V9h3V7a5 5 0 0 1 5-5m-1 11v5h2v-5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgUnlocked;
