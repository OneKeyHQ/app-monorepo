import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBallBasket = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.185 0 9.448 3.947 9.95 9H22v2h-.05c-.502 5.053-4.765 9-9.95 9s-9.448-3.947-9.95-9H2v-2h.05C2.552 5.947 6.815 2 12 2M8.948 13a9.95 9.95 0 0 1-2.065 5.146A7.96 7.96 0 0 0 11 19.936V13zM13 19.936a7.96 7.96 0 0 0 4.115-1.788A9.95 9.95 0 0 1 15.051 13H13zM17.064 13a7.95 7.95 0 0 0 1.436 3.661A7.96 7.96 0 0 0 19.936 13zm-13 0A7.96 7.96 0 0 0 5.5 16.66 7.95 7.95 0 0 0 6.936 13zM5.5 7.34A7.95 7.95 0 0 0 4.064 11h2.872a7.95 7.95 0 0 0-1.437-3.66ZM11 4.063a7.96 7.96 0 0 0-4.118 1.789A9.95 9.95 0 0 1 8.948 11H11zm7.5 3.276A7.95 7.95 0 0 0 17.064 11h2.872A7.95 7.95 0 0 0 18.5 7.339M13 11h2.05c.193-1.93.934-3.7 2.066-5.15A7.96 7.96 0 0 0 13 4.064z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBallBasket;
