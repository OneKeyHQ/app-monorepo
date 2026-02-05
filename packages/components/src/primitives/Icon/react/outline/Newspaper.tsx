import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNewspaper = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 13v4.5a1.5 1.5 0 0 0 3 0V13zm-5 2a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2zm0-8a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm-4 4h3V9H8zM4 5v12.5A1.5 1.5 0 0 0 5.5 19h9.837A3.5 3.5 0 0 1 15 17.5V5zm13 6h3a2 2 0 0 1 2 2v4.5a3.5 3.5 0 0 1-3.5 3.5h-13A3.5 3.5 0 0 1 2 17.5V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgNewspaper;
