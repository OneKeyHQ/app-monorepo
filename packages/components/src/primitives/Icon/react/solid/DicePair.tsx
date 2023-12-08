import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDicePair = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M14.55 11.216a3 3 0 0 1-1.793-3.846l1.026-2.819a3 3 0 0 1 3.845-1.793l2.819 1.026A3 3 0 0 1 22.24 7.63l-1.026 2.82a3 3 0 0 1-3.845 1.793l-2.82-1.027Zm2.608-2.776a1 1 0 1 0 .684-1.88 1 1 0 0 0-.684 1.88ZM2.91 10.572a3 3 0 0 0-1.45 3.987l2.112 4.531a3 3 0 0 0 3.987 1.451l4.532-2.113a3 3 0 0 0 1.45-3.987L11.43 9.91a3 3 0 0 0-3.987-1.451L2.91 10.572Zm3.501 2.78a1 1 0 1 1-1.813.845 1 1 0 0 1 1.813-.845Zm3.505 2.78a1 1 0 1 0-.846-1.813 1 1 0 0 0 .846 1.813Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDicePair;
