import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMagicBook = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M4 4a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2zm2 12h12V4H6zm12 2H6v2h12z"
      clipRule="evenodd"
    />
    <Path d="M12.184 7.408a.5.5 0 0 0 .224-.224l.645-1.29a.5.5 0 0 1 .894 0l.645 1.29a.5.5 0 0 0 .224.224l1.29.645a.5.5 0 0 1 0 .894l-1.29.645a.5.5 0 0 0-.224.224l-.645 1.29a.5.5 0 0 1-.894 0l-.645-1.29a.5.5 0 0 0-.223-.224l-1.29-.645a.5.5 0 0 1 0-.894zm-3.606 4.303a.3.3 0 0 0 .134-.134l.52-1.04a.3.3 0 0 1 .537 0l.52 1.04a.3.3 0 0 0 .134.134l1.04.52a.3.3 0 0 1 0 .537l-1.04.52a.3.3 0 0 0-.134.135l-.52 1.04a.3.3 0 0 1-.537 0l-.52-1.04a.3.3 0 0 0-.134-.134l-1.041-.52a.3.3 0 0 1 0-.537z" />
  </Svg>
);
export default SvgMagicBook;
