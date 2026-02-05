import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDossier = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 6a2 2 0 0 1 2-2h4v6h14v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
    <Path d="M10 4h5v4h-5zm7 0h3a2 2 0 0 1 2 2v2h-5z" />
  </Svg>
);
export default SvgDossier;
