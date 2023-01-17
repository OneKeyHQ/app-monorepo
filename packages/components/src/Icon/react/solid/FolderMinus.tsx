import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolderMinus = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M19.5 21a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-5.379a.75.75 0 0 1-.53-.22L11.47 3.66A2.25 2.25 0 0 0 9.879 3H4.5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h15zM9 12.75a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5H9z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolderMinus;
