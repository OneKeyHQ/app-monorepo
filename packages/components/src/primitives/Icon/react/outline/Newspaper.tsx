import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNewspaper = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 17H6v-2h7z" />
    <Path fillRule="evenodd" d="M13 13H6V7h7zm-5-2h3V9H8z" clipRule="evenodd" />
    <Path
      fillRule="evenodd"
      d="M17 11h5v6.5a3.5 3.5 0 0 1-3.5 3.5h-13A3.5 3.5 0 0 1 2 17.5V3h15zM4 17.5A1.5 1.5 0 0 0 5.5 19h9.837A3.5 3.5 0 0 1 15 17.5V5H4zm13 0a1.5 1.5 0 0 0 3 0V13h-3z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNewspaper;
