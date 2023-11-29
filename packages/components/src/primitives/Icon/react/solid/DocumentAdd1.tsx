import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDocumentAdd1 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h8.17c-.11-.313-.17-.65-.17-1a3 3 0 1 1 0-6 3 3 0 0 1 5-2.236V5a3 3 0 0 0-3-3H7Z"
    />
    <Path
      fill="currentColor"
      d="M19 15a1 1 0 1 0-2 0v2h-2a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2v-2Z"
    />
  </Svg>
);
export default SvgDocumentAdd1;
