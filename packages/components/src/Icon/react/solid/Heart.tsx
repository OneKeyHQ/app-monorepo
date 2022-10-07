import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgHeart = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path
      fillRule="evenodd"
      d="M3.172 5.172a4 4 0 0 1 5.656 0L10 6.343l1.172-1.171a4 4 0 1 1 5.656 5.656L10 17.657l-6.828-6.829a4 4 0 0 1 0-5.656z"
      clipRule="evenodd"
    />
  </Svg>
);

export default SvgHeart;
