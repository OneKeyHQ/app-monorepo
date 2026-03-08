import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDossier = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM4 18h16v-8H8V6H4zm6-10h4V6h-4zm6 0h4V6h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDossier;
