import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCalculator = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6zm1 2a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H7zm6 7a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1zm-3 3a1 1 0 1 0 0 2h.01a1 1 0 1 0 0-2H10zm-4 1a1 1 0 0 1 1-1h.01a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1zm1-4a1 1 0 1 0 0 2h.01a1 1 0 1 0 0-2H7zm2 1a1 1 0 0 1 1-1h.01a1 1 0 1 1 0 2H10a1 1 0 0 1-1-1zm4-4a1 1 0 1 0 0 2h.01a1 1 0 1 0 0-2H13zM9 9a1 1 0 0 1 1-1h.01a1 1 0 1 1 0 2H10a1 1 0 0 1-1-1zM7 8a1 1 0 0 0 0 2h.01a1 1 0 0 0 0-2H7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalculator;
