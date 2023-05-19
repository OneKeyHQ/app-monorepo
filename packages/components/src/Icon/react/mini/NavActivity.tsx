import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNavActivity = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7.67 2h8.67C19.73 2 22 4.38 22 7.92v8.17c0 3.53-2.27 5.91-5.66 5.91H7.67C4.28 22 2 19.62 2 16.09V7.92C2 4.38 4.28 2 7.67 2Zm6.706 11.681 2.89-3.729-.04.02c.16-.22.19-.5.08-.75a.737.737 0 0 0-.609-.44.768.768 0 0 0-.7.31l-2.42 3.13-2.77-2.18a.79.79 0 0 0-.57-.16.775.775 0 0 0-.5.299l-2.96 3.851-.06.09a.747.747 0 0 0 .21.95c.14.09.29.15.46.15.23.01.45-.111.59-.3l2.51-3.231 2.85 2.141.09.059c.32.17.72.091.95-.21Z"
    />
  </Svg>
);
export default SvgNavActivity;
