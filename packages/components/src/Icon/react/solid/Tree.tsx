import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTree = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 2a9 9 0 0 0-1 17.945V21a1 1 0 1 0 2 0v-1.055A9.001 9.001 0 0 0 12 2Zm-1 15.93v-2.516l-1.707-1.707a1 1 0 1 1 1.414-1.414L12 13.586l2.293-2.293a1 1 0 0 1 1.414 1.414L13 15.414v2.515a7.062 7.062 0 0 1-2 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTree;
