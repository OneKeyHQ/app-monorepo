import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolderDownload = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 6a3 3 0 0 1 3-3h3.93a3 3 0 0 1 2.496 1.336L12.536 6H19a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V6Zm13.207 9.207-2.5 2.5a1 1 0 0 1-1.414 0l-2.5-2.5a1 1 0 1 1 1.414-1.414l.793.793V11a1 1 0 1 1 2 0v3.586l.793-.793a1 1 0 0 1 1.414 1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolderDownload;
