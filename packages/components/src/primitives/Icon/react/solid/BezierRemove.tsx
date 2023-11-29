import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBezierRemove = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path fill="currentColor" d="M10 11a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2h-4Z" />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2h6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2v6a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2H9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2V9a2 2 0 0 1-2-2V5Zm4 4v6a2 2 0 0 1 2 2h6a2 2 0 0 1 2-2V9a2 2 0 0 1-2-2H9a2 2 0 0 1-2 2Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBezierRemove;
