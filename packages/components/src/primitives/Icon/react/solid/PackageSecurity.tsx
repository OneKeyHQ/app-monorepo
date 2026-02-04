import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageSecurity = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8.001c-.61-.878-1.001-1.97-1.001-3.283V15a3 3 0 0 1 1.521-2.61c1.377-.78 2.864-1.273 4.479-1.273a8.4 8.4 0 0 1 3 .571V5a2 2 0 0 0-2-2h-3v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" />
    <Path d="M14 3h-4v4h4z" />
    <Path
      fillRule="evenodd"
      d="M21.493 14.13c-1.151-.652-2.3-1.013-3.493-1.013-1.192 0-2.342.36-3.493 1.013A1 1 0 0 0 14 15v2.717c0 1.27.53 2.187 1.28 2.854.7.62 1.593 1.022 2.314 1.343a1 1 0 0 0 .812 0c.72-.32 1.615-.723 2.314-1.343.75-.667 1.28-1.585 1.28-2.854V15a1 1 0 0 0-.507-.87M16 17.717v-2.11c.72-.339 1.374-.49 2-.49s1.28.151 2 .49v2.11c0 .628-.23 1.023-.608 1.358-.351.312-.819.562-1.392.828-.573-.266-1.04-.516-1.392-.828-.378-.335-.608-.73-.608-1.358"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPackageSecurity;
