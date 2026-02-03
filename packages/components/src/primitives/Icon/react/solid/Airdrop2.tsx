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
      d="M18.745 12.857c-2.056-1.26-4.01-1.946-5.927-2.097v4.513c.627 0 1.172.352 1.447.87zm-4.29 5.17a1 1 0 0 0 .074-.049l6.137-4.5a.82.82 0 0 0 .334-.66 9 9 0 1 0-18 0c0 .26.124.506.334.66l6.137 4.5a1 1 0 0 0 .074.049v.518c0 .904.733 1.637 1.637 1.637h1.636c.904 0 1.636-.733 1.636-1.637v-.518Zm-4.72-1.884c.275-.518.82-.87 1.447-.87V10.76c-1.916.151-3.871.837-5.927 2.097z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAirdrop2;
