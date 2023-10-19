import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTag = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 5a3 3 0 0 1 3-3h6.172a3 3 0 0 1 2.12.879l7.75 7.75a3 3 0 0 1 0 4.242l-6.17 6.172a3 3 0 0 1-4.243 0l-7.75-7.75A3 3 0 0 1 2 11.172V5Zm5.5 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTag;
