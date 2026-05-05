import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageQuestion = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21.002 19.036h-5.626l-3.382 2.802-3.343-2.802H3.002V3h18zM11 14v2h2v-2zm1.123-7.087c-1.39 0-2.5 1.135-2.5 2.515h2c0-.294.233-.515.5-.515.268 0 .5.221.5.515l-.002.02a.2.2 0 0 1-.035.113 1.1 1.1 0 0 1-.267.225l-.043.03c-.368.247-1.276.859-1.276 2.098v1h2v-1c0-.053.008-.082.015-.098a.3.3 0 0 1 .047-.075c.07-.083.175-.16.381-.3.437-.297 1.18-.885 1.18-2.013 0-1.38-1.11-2.515-2.5-2.515"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageQuestion;
