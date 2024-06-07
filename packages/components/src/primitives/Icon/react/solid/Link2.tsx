import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLink2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      d="M13.172 5.172a4 4 0 1 1 5.656 5.656l-2 2a4 4 0 0 1-5.656 0 1 1 0 0 0-1.415 1.415 6 6 0 0 0 8.486 0l2-2a6 6 0 1 0-8.486-8.486 1 1 0 0 0 1.415 1.415Z"
      fill="currentColor"
    />
    <Path
      d="M7.172 11.172a4 4 0 0 1 5.656 0 1 1 0 0 0 1.415-1.415 6 6 0 0 0-8.486 0l-2 2a6 6 0 0 0 8.486 8.486 1 1 0 1 0-1.415-1.415 4 4 0 0 1-5.656-5.656l2-2Z"
      fill="currentColor"
    />
  </Svg>
);
export default SvgLink2;
