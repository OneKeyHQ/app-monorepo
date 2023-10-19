import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolderOpen = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5 3a3 3 0 0 0-3 3v11.56A2.44 2.44 0 0 0 4.44 20h13.661a3 3 0 0 0 2.793-2.105l1.655-5.298A2 2 0 0 0 21 10.032V9a3 3 0 0 0-3-3h-5.465l-1.11-1.664A3 3 0 0 0 8.93 3H5Zm14 7V9a1 1 0 0 0-1-1h-5.465a2 2 0 0 1-1.664-.89l-1.11-1.665A1 1 0 0 0 8.93 5H5a1 1 0 0 0-1 1v11.56a.44.44 0 0 0 .861.13l1.746-5.585A3 3 0 0 1 9.47 10H19Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolderOpen;
