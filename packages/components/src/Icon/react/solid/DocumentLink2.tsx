import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDocumentLink2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v4.341A6 6 0 0 0 12 15v3c0 1.537.578 2.939 1.528 4H7a3 3 0 0 1-3-3V5Zm3 1a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Zm0 4a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M16 15a2 2 0 1 1 4 0 1 1 0 1 0 2 0 4 4 0 0 0-8 0 1 1 0 1 0 2 0Z"
    />
    <Path fill="currentColor" d="M19 16a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0v-1Z" />
    <Path
      fill="currentColor"
      d="M16 18a1 1 0 1 0-2 0 4 4 0 0 0 8 0 1 1 0 1 0-2 0 2 2 0 1 1-4 0Z"
    />
  </Svg>
);
export default SvgDocumentLink2;
