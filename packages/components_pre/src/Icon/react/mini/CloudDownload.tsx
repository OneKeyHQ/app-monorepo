import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCloudDownload = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2 9.5A3.5 3.5 0 0 0 5.5 13H9v2.586l-1.293-1.293a1 1 0 0 0-1.414 1.414l3 3a1 1 0 0 0 1.414 0l3-3a1 1 0 0 0-1.414-1.414L11 15.586V13h2.5a4.5 4.5 0 1 0-.616-8.958 4.002 4.002 0 1 0-7.753 1.977A3.5 3.5 0 0 0 2 9.5zm9 3.5H9V8a1 1 0 0 1 2 0v5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCloudDownload;
