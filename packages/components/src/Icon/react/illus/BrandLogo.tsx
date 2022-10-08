import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgBrandLogo = (props: SvgProps) => (
  <Svg viewBox="0 0 27 27" fill="none" {...props}>
    <Path
      d="M13.459 19.272a2.331 2.331 0 1 0 0-4.663 2.331 2.331 0 0 0 0 4.663Z"
      fill="#00B812"
    />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M13.459 26.918c9.291 0 13.459-4.168 13.459-13.46C26.918 4.169 22.75 0 13.458 0 4.169 0 0 4.167 0 13.459c0 9.291 4.167 13.459 13.459 13.459ZM10.93 5.707h3.744v6.17h-2.322V7.693h-2.08l.658-1.986Zm2.528 15.504a4.27 4.27 0 1 0 0-8.54 4.27 4.27 0 0 0 0 8.54Z"
      fill="#00B812"
    />
  </Svg>
);

export default SvgBrandLogo;
