import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgExpand = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M9 13a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3h4Z"
    />
    <Path
      fill="currentColor"
      d="M20 6a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v4a1 1 0 1 1-2 0V6a3 3 0 0 1 3-3h13a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-4a1 1 0 1 1 0-2h4a1 1 0 0 0 1-1V6Z"
    />
    <Path
      fill="currentColor"
      d="M17 7a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-.586l-1.293 1.293a1 1 0 0 1-1.414-1.414L14.586 9H14a1 1 0 1 1 0-2h3Z"
    />
  </Svg>
);
export default SvgExpand;
