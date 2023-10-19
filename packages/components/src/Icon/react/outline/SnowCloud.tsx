import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSnowCloud = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 9.5a6.5 6.5 0 0 1 11.9-3.62c.066.1.235.19.426.165A5 5 0 1 1 16 16H9.5A6.5 6.5 0 0 1 3 9.5ZM9.5 5a4.5 4.5 0 0 0 0 9H16a3 3 0 1 0-.407-5.973c-.872.118-1.822-.24-2.354-1.032A4.494 4.494 0 0 0 9.5 5Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M13 18a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-6 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm3 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm9-2a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-3 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
    />
  </Svg>
);
export default SvgSnowCloud;
