import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAlbums = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M14.242 5.091a1 1 0 0 0-1.242.97v11.877a1 1 0 0 0 1.242.97l4-1a1 1 0 0 0 .758-.97V7.062a1 1 0 0 0-.758-.97l-4-1ZM11 6.061a3 3 0 0 1 3.728-2.91l4 1A3 3 0 0 1 21 7.061v9.877a3 3 0 0 1-2.272 2.91l-4 1A3 3 0 0 1 11 17.939V6.062ZM8 4a1 1 0 0 1 1 1v14a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1ZM4 5a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAlbums;
