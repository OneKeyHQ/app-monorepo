import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolderDisable = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5 3a3 3 0 0 0-3 3v4.254A7.002 7.002 0 0 1 11.746 20H19a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-5.93a1 1 0 0 1-.832-.445l-.812-1.22A3 3 0 0 0 8.93 3H5Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2.465 12.464a5 5 0 1 0 7.071 7.071 5 5 0 0 0-7.07-7.07Zm1.414 5.657a3.001 3.001 0 0 1-.586-3.414l4.001 4a3.001 3.001 0 0 1-3.415-.586Zm4.83-.827-4.002-4.002a3.001 3.001 0 0 1 4.001 4.002Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolderDisable;
