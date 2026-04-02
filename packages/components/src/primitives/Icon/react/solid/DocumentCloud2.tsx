import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentCloud2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20 13.168A6.25 6.25 0 0 0 11.167 22H4V2h16zM7 11h4V9H7zm0-4h8V5H7z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M15.75 13.5c1.318 0 2.494.6 3.273 1.54A3.5 3.5 0 0 1 18.5 22h-2.75a4.25 4.25 0 0 1 0-8.5m0 2a2.25 2.25 0 0 0 0 4.5h2.75a1.5 1.5 0 1 0-.589-2.88 2.25 2.25 0 0 0-2.161-1.62"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDocumentCloud2;
