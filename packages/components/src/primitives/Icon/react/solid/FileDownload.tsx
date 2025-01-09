import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFileDownload = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7 2h5v5a3 3 0 0 0 3 3h5v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Zm8.207 15.207-2.5 2.5a1 1 0 0 1-1.414 0l-2.5-2.5a1 1 0 1 1 1.414-1.414l.793.793V13a1 1 0 1 1 2 0v3.586l.793-.793a1 1 0 0 1 1.414 1.414Z"
      clipRule="evenodd"
    />
    <Path fill="currentColor" d="M14 2.586 19.414 8H15a1 1 0 0 1-1-1V2.586Z" />
  </Svg>
);
export default SvgFileDownload;
