import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolderLink = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5 3a3 3 0 0 0-3 3v5.803A5.973 5.973 0 0 1 5 11h3a6 6 0 0 1 5.197 9H19a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-5.93a1 1 0 0 1-.832-.445l-.812-1.22A3 3 0 0 0 8.93 3H5Z"
    />
    <Path
      fill="currentColor"
      d="M8 13a1 1 0 1 0 0 2 2 2 0 1 1 0 4 1 1 0 1 0 0 2 4 4 0 0 0 0-8Zm-3 0a4 4 0 0 0 0 8 1 1 0 1 0 0-2 2 2 0 1 1 0-4 1 1 0 1 0 0-2Z"
    />
    <Path fill="currentColor" d="M6 16a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2H6Z" />
  </Svg>
);
export default SvgFolderLink;
