import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDocumentAdd2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7.764A3 3 0 1 0 15 21c0 .35.06.687.17 1H7a3 3 0 0 1-3-3V5Zm4 0a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H8Zm0 4a1 1 0 0 0 0 2h2a1 1 0 1 0 0-2H8Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M19 15a1 1 0 1 0-2 0v2h-2a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2v-2Z"
    />
  </Svg>
);
export default SvgDocumentAdd2;
