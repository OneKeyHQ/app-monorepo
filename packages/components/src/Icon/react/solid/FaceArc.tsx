import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFaceArc = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm8-5a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm-5.894 7.803a1 1 0 0 1 1.341-.447c1.719.859 3.387.859 5.106 0a1 1 0 1 1 .894 1.788c-2.281 1.141-4.613 1.141-6.894 0a1 1 0 0 1-.447-1.341Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFaceArc;
