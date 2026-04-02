import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOpenQuote = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M8.003 10h3L11 20H2v-9c0-2.585 1.162-4.335 2.316-5.417a8.2 8.2 0 0 1 2.098-1.42q.1-.045.16-.07l.05-.019.015-.007q.003 0 .006-.002h.001c.001 0 .003-.001.354.934l-.352-.936L8 3.558zm-2.32-2.958C4.839 7.835 4 9.085 4 11v7h5l.004-6h-3l-.003-5.235a6 6 0 0 0-.317.277ZM19 10h3v10h-9v-9c0-2.585 1.162-4.335 2.316-5.417a8.2 8.2 0 0 1 2.098-1.42q.1-.045.16-.07l.049-.019.016-.007q.003 0 .006-.002h.002s.002-.001.353.935l-.352-.937L19 3.557zm-2.316-2.958C15.838 7.835 15 9.085 15 11v7h5v-6h-3V6.766q-.157.128-.316.276"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOpenQuote;
