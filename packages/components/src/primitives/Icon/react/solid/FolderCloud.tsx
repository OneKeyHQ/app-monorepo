import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderCloud = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5.25 12.5c1.318 0 2.494.6 3.272 1.54A3.5 3.5 0 0 1 8 21H5.25a4.25 4.25 0 0 1 0-8.5m0 2a2.25 2.25 0 0 0 0 4.5H8a1.5 1.5 0 1 0-.589-2.88A2.25 2.25 0 0 0 5.25 14.5"
      clipRule="evenodd"
    />
    <Path d="M12.535 6H22v14h-9.1a5.5 5.5 0 0 0-3.34-7.774A6.23 6.23 0 0 0 5.25 10.5a6.2 6.2 0 0 0-3.25.91V3h8.535z" />
  </Svg>
);
export default SvgFolderCloud;
