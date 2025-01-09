import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMagicBook = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 5a3 3 0 0 1 3-3h12a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a3 3 0 0 1-3-3V5Zm2 11.17V5a1 1 0 0 1 1-1h11v12H7c-.35 0-.687.06-1 .17ZM18 18H7a1 1 0 1 0 0 2h11v-2Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M12.184 7.408a.5.5 0 0 0 .224-.224l.645-1.29a.5.5 0 0 1 .894 0l.645 1.29a.5.5 0 0 0 .224.224l1.29.645a.5.5 0 0 1 0 .894l-1.29.645a.5.5 0 0 0-.224.224l-.645 1.29a.5.5 0 0 1-.894 0l-.645-1.29a.5.5 0 0 0-.223-.224l-1.29-.645a.5.5 0 0 1 0-.894l1.29-.645Zm-3.606 4.303a.3.3 0 0 0 .134-.134l.52-1.04a.3.3 0 0 1 .537 0l.52 1.04a.3.3 0 0 0 .134.134l1.04.52a.3.3 0 0 1 0 .537l-1.04.52a.3.3 0 0 0-.134.135l-.52 1.04a.3.3 0 0 1-.537 0l-.52-1.04a.3.3 0 0 0-.134-.134l-1.041-.52a.3.3 0 0 1 0-.537l1.04-.52Z"
    />
  </Svg>
);
export default SvgMagicBook;
