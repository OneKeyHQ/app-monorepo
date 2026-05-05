import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgToolbox = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m8.785 2.375 2 2.5.219.274V10H12V2h8v8h2v11H2V10h2.004V5.15l.219-.275 2-2.5.3-.375h1.961zM4 19h16v-7H4zM6.004 5.852V10h3V5.852L7.522 4h-.037zM14 6h2.004v2H14v2h4V4h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgToolbox;
