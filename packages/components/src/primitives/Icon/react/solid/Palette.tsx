import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPalette = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2.5c5.468 0 10 4.2 10 9.5 0 1.874-.505 3.22-1.651 3.934-1.048.652-2.352.57-3.373.438-.363-.047-.745-.11-1.104-.17l-.47-.076a9.6 9.6 0 0 0-1.33-.14c-.774-.012-1.032.17-1.177.461-.083.166-.103.394.028.78.117.348.305.686.521 1.078l.118.215c.12.22.256.477.352.73.088.232.203.612.118 1.028-.104.511-.456.853-.866 1.03-.354.152-.765.192-1.166.192-5.468 0-10-4.2-10-9.5s4.532-9.5 10-9.5m-4.75 8.25a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M15.5 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m-5-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPalette;
