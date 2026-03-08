import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageSecurity = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 3v8h-2V5h-3v5H8V5H5v14h7v2H3V3zM10 8h4V5h-4z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M22 17.717c0 1.27-.53 2.188-1.28 2.854-.699.62-1.593 1.023-2.314 1.343l-.406.18-.406-.18c-.721-.32-1.615-.723-2.314-1.343-.75-.666-1.28-1.585-1.28-2.854v-3.3l.507-.287c1.15-.652 2.3-1.013 3.493-1.013 1.192 0 2.342.36 3.493 1.013l.507.287zm-2-2.108c-.72-.338-1.374-.492-2-.492s-1.28.154-2 .492v2.108c0 .628.23 1.023.607 1.358.351.312.82.56 1.393.825.573-.265 1.042-.513 1.393-.825.378-.335.607-.73.607-1.358z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPackageSecurity;
