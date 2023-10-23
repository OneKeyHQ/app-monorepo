import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgQuestionmark = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm0 7a1 1 0 0 0-.879.522 1 1 0 1 1-1.754-.96A3 3 0 0 1 12 7c1.515 0 2.567 1.006 2.866 2.189.302 1.189-.156 2.574-1.524 3.258A.618.618 0 0 0 13 13a1 1 0 1 1-2 0c0-.992.56-1.898 1.447-2.342.455-.227.572-.618.48-.978C12.836 9.314 12.529 9 12 9Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgQuestionmark;
