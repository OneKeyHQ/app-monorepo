import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNavBankCard = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22.994 9H1.006c.018-1.35.096-2.16.43-2.816a4 4 0 0 1 1.748-1.748C4.04 4 5.16 4 7.4 4h9.2c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748c.334.655.412 1.466.43 2.816Z" />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1 10.561h22V13.6c0 2.24 0 3.36-.436 4.216a4 4 0 0 1-1.748 1.748C19.96 20 18.84 20 16.6 20H7.4c-2.24 0-3.36 0-4.216-.436a4 4 0 0 1-1.748-1.748C1 16.96 1 15.84 1 13.6v-3.039Zm3.78 6h3.44a.781.781 0 0 0 0-1.561H4.78a.781.781 0 0 0 0 1.561Z"
    />
  </Svg>
);
export default SvgNavBankCard;
