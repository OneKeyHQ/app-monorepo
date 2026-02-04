import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLightning = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.117 2a1.5 1.5 0 0 1 1.286 2.271L16.767 7h3.92c1.379 0 2.027 1.703.998 2.62L8.042 21.77c-1.142 1.018-2.896-.127-2.424-1.582L7.625 14H4.56a1.5 1.5 0 0 1-1.342-2.17l4.5-9 .107-.183A1.5 1.5 0 0 1 9.06 2zM5.368 12h2.945a1.5 1.5 0 0 1 1.426 1.963l-1.65 5.086L19.374 9h-3.49a1.5 1.5 0 0 1-1.287-2.271L16.235 4H9.367z" />
  </Svg>
);
export default SvgLightning;
