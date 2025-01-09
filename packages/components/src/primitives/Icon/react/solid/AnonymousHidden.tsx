import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAnonymousHidden = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M19.235 5.576 19.867 10H21a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2h1.133l.632-4.424A3 3 0 0 1 7.735 3h8.53a3 3 0 0 1 2.97 2.576Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7 13a4 4 0 1 0 3.99 4.273 2.005 2.005 0 0 1 2.02 0 4 4 0 1 0 .391-2.02 4.014 4.014 0 0 0-2.802 0A4 4 0 0 0 7 13Zm-2 4a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm10.006-.154a2 2 0 1 1 3.988.308 2 2 0 0 1-3.988-.308Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAnonymousHidden;
