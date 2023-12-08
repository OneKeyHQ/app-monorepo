import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSplit = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 4a1 1 0 0 1 1-1h5a1 1 0 0 1 0 2H6.414L12 10.586 17.586 5H15a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V6.414l-6 6V20a1 1 0 1 1-2 0v-7.586l-6-6V9a1 1 0 0 1-2 0V4Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSplit;
