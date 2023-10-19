import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAlignTop = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 3a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm6.586 3.75a2 2 0 0 1 2.828 0l3.543 3.543a1 1 0 0 1-1.414 1.414L13 9.164V21a1 1 0 1 1-2 0V9.164l-2.543 2.543a1 1 0 0 1-1.414-1.414l3.543-3.543Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAlignTop;
