import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAiText = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M19.245 12.754 23.736 15l-4.49 2.245L17 21.736l-2.246-4.49L10.264 15l4.49-2.246L17 8.264zm-2.85 1.193-.15.298-.298.15-1.21.605 1.21.605.298.15.15.298.605 1.21.605-1.21.15-.298.298-.15 1.21-.605-1.21-.605-.298-.15-.15-.298-.605-1.21z"
      clipRule="evenodd"
    />
    <Path d="M8 19H3v-2h5zm2-6H3v-2h7zm11-6H3V5h18z" />
  </Svg>
);
export default SvgAiText;
