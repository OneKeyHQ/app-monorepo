import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPeopleCopy = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M4 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2V4a2 2 0 0 0-2-2zm12 4V4H4v12h2V8a2 2 0 0 1 2-2zm-2 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M9.752 20c-.358 0-.597-.366-.433-.683 2.291-4.423 7.07-4.423 9.362 0 .165.317-.075.683-.433.683z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPeopleCopy;
