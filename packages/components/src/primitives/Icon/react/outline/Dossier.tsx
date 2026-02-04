import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDossier = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 6v2h4V6zm-6 2h4V6h-4zM4 18h16v-8H9a1 1 0 0 1-1-1V6H4zm18 0a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgDossier;
