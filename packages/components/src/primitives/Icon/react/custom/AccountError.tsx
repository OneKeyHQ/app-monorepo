import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAccountError = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 18 18" accessibilityRole="image" {...props}>
    <Path
      fill="#000"
      fillOpacity={0.447}
      d="M12.5 12.75a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5"
    />
    <Path
      fill="#000"
      fillOpacity={0.447}
      fillRule="evenodd"
      d="M0 3.5A3.5 3.5 0 0 1 3.5 0h8.088A2.41 2.41 0 0 1 14 2.412V5h1a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H4a4 4 0 0 1-4-4zm2 3.163V14a2 2 0 0 0 2 2h11a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H3.5c-.537 0-1.045-.12-1.5-.337M2 3.5A1.5 1.5 0 0 0 3.5 5H12V2.412A.41.41 0 0 0 11.588 2H3.5A1.5 1.5 0 0 0 2 3.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAccountError;
