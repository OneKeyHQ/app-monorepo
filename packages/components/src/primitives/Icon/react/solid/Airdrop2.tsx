import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAirdrop2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2a9 9 0 0 1 9 9v.486L15.255 16H17v6H7v-6h1.745L3 11.486V11a9 9 0 0 1 9-9m-1 9.515a85 85 0 0 0-4.097.232l-.303.024 4.4 3.457zm2 3.713 4.4-3.457-.303-.024A85 85 0 0 0 13 11.515z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAirdrop2;
