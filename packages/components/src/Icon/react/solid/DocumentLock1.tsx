import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDocumentLock1 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M4 5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a5.002 5.002 0 0 0-7.802 2.601A2.996 2.996 0 0 0 11 17v4c0 .35.06.687.17 1H7a3 3 0 0 1-3-3V5Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M20 16.268V16a3 3 0 1 0-6 0v.268A2 2 0 0 0 13 18v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-1-1.732ZM16 16h2a1 1 0 1 0-2 0Zm3 2h-4v2h4v-2Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDocumentLock1;
