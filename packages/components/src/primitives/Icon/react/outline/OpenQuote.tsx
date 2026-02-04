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
      d="M6.647 4.064A1 1 0 0 1 7.999 5v5h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-1.999V11c0-2.585 1.162-4.335 2.316-5.417a8.2 8.2 0 0 1 2.098-1.42q.1-.045.16-.07l.049-.019.015-.007q.003 0 .006-.002h.002s.007.01.354.935zm-.965 2.978C4.836 7.835 4 9.086 4 11v7h5v-6H7a1 1 0 0 1-1-1V6.766a6 6 0 0 0-.317.276Zm11.965-2.978a1 1 0 0 1 1.352.935L19.002 10h1a2 2 0 0 1 2 2.001l-.002 6A2 2 0 0 1 20 20h-5.002a2 2 0 0 1-2-1.999V11c0-2.585 1.163-4.335 2.317-5.417a8.2 8.2 0 0 1 1.568-1.15 7 7 0 0 1 .69-.34l.049-.019.015-.007q.003 0 .006-.002h.002s.007.01.354.934zm-.965 2.978C15.837 7.835 15 9.086 15 11v7h5l.003-6h-2a1 1 0 0 1-1-.999L17 6.765a6 6 0 0 0-.318.277"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOpenQuote;
