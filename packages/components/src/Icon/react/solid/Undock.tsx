import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUndock = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 4.75C3 3.784 3.784 3 4.75 3H10a1 1 0 1 1 0 2H6.414l4.543 4.543a1 1 0 0 1-1.414 1.414L5 6.414V10a1 1 0 1 1-2 0V4.75ZM13 7a1 1 0 0 1 1-1h5a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-5a1 1 0 1 1 2 0v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-5a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgUndock;
