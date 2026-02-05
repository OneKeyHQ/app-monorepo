import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKeyboardConnect = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M19 3a1 1 0 1 0-2 0v1H7a2 2 0 0 0-2 2v2H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2H7V6h10a2 2 0 0 0 2-2zm-9 13a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2zm-5.25-3a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0m12 0a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0M14 14.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5M8.75 13a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0M6 18.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5M16.75 17a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgKeyboardConnect;
