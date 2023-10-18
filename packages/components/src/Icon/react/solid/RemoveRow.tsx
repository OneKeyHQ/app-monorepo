import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRemoveRow = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5 4a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h6a1 1 0 1 0 0-2H5a1 1 0 0 1-1-1v-4h17a1 1 0 0 0 1-1V7a3 3 0 0 0-3-3H5Z"
    />
    <Path
      fill="currentColor"
      d="M17.707 16.293a1 1 0 0 0-1.414 1.414L17.586 19l-1.293 1.293a1 1 0 0 0 1.414 1.414L19 20.414l1.293 1.293a1 1 0 0 0 1.414-1.414L20.414 19l1.293-1.293a1 1 0 0 0-1.414-1.414L19 17.586l-1.293-1.293Z"
    />
  </Svg>
);
export default SvgRemoveRow;
