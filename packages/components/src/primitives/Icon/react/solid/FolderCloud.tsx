import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolderCloud = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5 3a3 3 0 0 0-3 3v5.41a6.221 6.221 0 0 1 3.25-.91c1.673 0 3.192.659 4.311 1.725A5.501 5.501 0 0 1 12.901 20H19a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-5.93a1 1 0 0 1-.832-.445l-.812-1.22A3 3 0 0 0 8.93 3H5Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5.25 12.5a4.25 4.25 0 0 0 0 8.5H8a3.5 3.5 0 0 0 .523-6.961A4.241 4.241 0 0 0 5.25 12.5ZM3 16.75a2.25 2.25 0 0 1 4.147-1.21 1 1 0 0 0 .844.46H8a1.5 1.5 0 0 1 0 3H5.25A2.25 2.25 0 0 1 3 16.75Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolderCloud;
