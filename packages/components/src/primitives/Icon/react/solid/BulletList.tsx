import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBulletList = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M6 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm7 2a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2h-7Zm-7 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm7 2a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2h-7Z"
    />
  </Svg>
);
export default SvgBulletList;
