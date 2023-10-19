import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPackage = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 3h2v4.5a2.5 2.5 0 0 0 2.5 2.5h3A2.5 2.5 0 0 0 16 7.5V3h2a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm9 13a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2h-2Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M10 3h4v4.5a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5V3Z"
    />
  </Svg>
);
export default SvgPackage;
