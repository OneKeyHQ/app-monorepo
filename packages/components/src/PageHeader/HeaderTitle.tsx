import { FC } from 'react';

import { useIsVerticalLayout } from '../Provider/hooks';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

const HeaderTitle: FC<PageHeaderProps> = ({ title, subtitle }) => {
  const isVertical = useIsVerticalLayout();
  return (
    <>
      <h1>{title}</h1>
      {subtitle && <h2>{subtitle}</h2>}
    </>
  );
};

export default HeaderTitle;
