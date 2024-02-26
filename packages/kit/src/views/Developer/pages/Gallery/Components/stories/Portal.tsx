/* eslint-disable react/no-unstable-nested-components */

import { useEffect, useMemo, useState } from 'react';

import { Button, Portal } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const ActiveDemo = () => {
  const [, setCount] = useState(0);
  useEffect(() => {
    setInterval(() => {
      setCount((i) => i + 1);
    }, 1000);
  }, []);
  const A = useMemo(() => <Button>++456</Button>, []);
  // const b = useMemo(() => <Button>++789</Button>, []);
  return (
    <>
      <Portal.Body container={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL}>
        {/* <Button>++456</Button> */}
        {A}
      </Portal.Body>
      {/* <Portal.Body container={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL}>
        <Button>++789</Button>
      </Portal.Body>
      <Portal.Body container={Portal.Constant.TOASTER_OVERLAY_PORTAL}>
        <Button>++789</Button>
      </Portal.Body> */}
    </>
  );
};

const PortalGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: '',
        element: <ActiveDemo />,
      },
    ]}
  />
);

export default PortalGallery;
