import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgShareScreen = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7Zm9.293.793a1 1 0 0 1 1.414 0l3 3a1 1 0 0 1-1.414 1.414L13 10.914V15.5a1 1 0 1 1-2 0v-4.586l-1.293 1.293a1 1 0 0 1-1.414-1.414l3-3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShareScreen;
