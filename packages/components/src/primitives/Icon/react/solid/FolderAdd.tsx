import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolderAdd = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5 3a3 3 0 0 0-3 3v8a3 3 0 1 1 6 0 3 3 0 1 1 0 6h11a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-5.93a1 1 0 0 1-.832-.445l-.812-1.22A3 3 0 0 0 8.93 3H5Z"
    />
    <Path
      fill="currentColor"
      d="M6 14a1 1 0 1 0-2 0v2H2a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2H6v-2Z"
    />
  </Svg>
);
export default SvgFolderAdd;
