import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderDisable = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2.464 12.465a5 5 0 1 1 7.07 7.07 5 5 0 0 1-7.07-7.07m.83 2.243a2.999 2.999 0 0 0 3.997 3.997zm4.827-.83a3 3 0 0 0-3.413-.584l3.997 3.997a3 3 0 0 0-.584-3.412ZM2 9V5a2 2 0 0 1 2-2h5.464a2 2 0 0 1 1.665.89L12.535 6H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7a1 1 0 1 1 0-2h7V8h-7.465a2 2 0 0 1-1.664-.89L9.464 5H4v4a1 1 0 1 1-2 0" />
  </Svg>
);
export default SvgFolderDisable;
