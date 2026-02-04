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
      d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zm0 16h12v2H6zm6.408-10.816a.5.5 0 0 1-.223.224l-1.29.645a.5.5 0 0 0 0 .894l1.29.645a.5.5 0 0 1 .223.224l.645 1.29a.5.5 0 0 0 .894 0l.645-1.29a.5.5 0 0 1 .224-.224l1.29-.645a.5.5 0 0 0 0-.894l-1.29-.645a.5.5 0 0 1-.224-.224l-.645-1.29a.5.5 0 0 0-.894 0zm-3.696 4.393a.3.3 0 0 1-.134.134l-1.041.52a.3.3 0 0 0 0 .537l1.04.52a.3.3 0 0 1 .135.135l.52 1.04a.3.3 0 0 0 .537 0l.52-1.04a.3.3 0 0 1 .134-.134l1.04-.52a.3.3 0 0 0 0-.537l-1.04-.52a.3.3 0 0 1-.134-.135l-.52-1.04a.3.3 0 0 0-.537 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMagicBook;
