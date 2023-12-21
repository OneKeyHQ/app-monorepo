import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBulletList = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M13 17h7M13 7h7M8 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm0 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
    />
  </Svg>
);
export default SvgBulletList;
