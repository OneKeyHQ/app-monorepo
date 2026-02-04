import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOption2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M17.16 6a1 1 0 0 0-.868.504L9.444 18.488A3 3 0 0 1 6.84 20H4a1 1 0 1 1 0-2h2.84a1 1 0 0 0 .868-.504l6.848-11.984A3 3 0 0 1 17.16 4H20a1 1 0 1 1 0 2zM15 19a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2h-4a1 1 0 0 1-1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOption2;
