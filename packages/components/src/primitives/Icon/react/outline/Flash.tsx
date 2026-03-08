import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFlash = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14.166 9h7.008L8.479 23.811 9.834 15H2.826L15.521.188zm-6.992 4h4.992l-.646 4.19L16.826 11h-4.992l.645-4.19z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFlash;
