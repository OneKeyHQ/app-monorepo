import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBezierAdd = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5 3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2v6a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2h6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2V9a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2H9a2 2 0 0 0-2-2H5Zm2 12V9a2 2 0 0 0 2-2h6a2 2 0 0 0 2 2v6a2 2 0 0 0-2 2H9a2 2 0 0 0-2-2Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M13 10a1 1 0 1 0-2 0v1h-1a1 1 0 1 0 0 2h1v1a1 1 0 1 0 2 0v-1h1a1 1 0 1 0 0-2h-1v-1Z"
    />
  </Svg>
);
export default SvgBezierAdd;
