import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAlbums = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6v12M8 5v14m4-12.938v11.876a2 2 0 0 0 2.485 1.94l4-1A2 2 0 0 0 20 16.939V7.062a2 2 0 0 0-1.515-1.94l-4-1A2 2 0 0 0 12 6.061Z"
    />
  </Svg>
);
export default SvgAlbums;
