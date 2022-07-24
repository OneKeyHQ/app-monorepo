import React, { FC, useState } from 'react';

import { TypeWriter } from '@onekeyhq/components';

import Layout from '../Layout';

import PinPanel from './PinPanel';

type BehindTheSceneProps = {
  visible?: boolean;
};

const defaultProps = {} as const;

const BehindTheScene: FC<BehindTheSceneProps> = ({ visible }) => {
  const [processOneTypingEnd, setIsProcessOneTypingEnd] = useState(false);
  const [processOneDone, setIsProcessOneDone] = useState(false);
  const [processTwoTypingEnd, setIsProcessTwoTypingEnd] = useState(false);
  const [processTwoDone, setIsProcessTwoDone] = useState(false);
  const [processThreeTypingEnd, setIsProcessThreeTypingEnd] = useState(false);
  const [processThreeDone, setIsProcessThreeDone] = useState(false);
  const [processFourTypingEnd, setIsProcessFourTypingEnd] = useState(false);
  const [processFourDone, setIsProcessFourDone] = useState(false);
  const [allTypingEnd, setIsAllTypingEnd] = useState(false);

  const handleProcessOneTypingEnd = () => {
    setIsProcessOneTypingEnd(true);

    setTimeout(() => {
      setIsProcessOneDone(true);
    }, 1000);
  };

  const handleProcessTwoTypingEnd = () => {
    setIsProcessTwoTypingEnd(true);

    setTimeout(() => {
      setIsProcessTwoDone(true);
    }, 1000);
  };

  const handleProcessThreeTypingEnd = () => {
    setIsProcessThreeTypingEnd(true);

    setTimeout(() => {
      setIsProcessThreeDone(true);
    }, 1000);
  };

  const handleProcessFourTypingEnd = () => {
    setIsProcessFourTypingEnd(true);

    setTimeout(() => {
      setIsProcessFourDone(true);
    }, 1000);
  };

  const handleAllTypingEnd = () => {
    setIsAllTypingEnd(true);
  };

  return (
    <>
      <Layout visible={visible} backButton={false}>
        <TypeWriter onTypingEnd={handleProcessOneTypingEnd} pending={false}>
          <TypeWriter.NormalText fadeOut={processOneDone}>
            Creating your <TypeWriter.Highlight>wallet</TypeWriter.Highlight>
          </TypeWriter.NormalText>
        </TypeWriter>
        {processOneTypingEnd ? (
          <TypeWriter
            pending={!processOneDone}
            onTypingEnd={handleProcessTwoTypingEnd}
          >
            <TypeWriter.NormalText fadeOut={processTwoDone}>
              Generating your{' '}
              <TypeWriter.Highlight>accounts</TypeWriter.Highlight>
            </TypeWriter.NormalText>
          </TypeWriter>
        ) : undefined}
        {processTwoTypingEnd ? (
          <TypeWriter
            pending={!processTwoDone}
            onTypingEnd={handleProcessThreeTypingEnd}
          >
            <TypeWriter.NormalText fadeOut={processThreeDone}>
              Verifying your <TypeWriter.Highlight>key</TypeWriter.Highlight>
            </TypeWriter.NormalText>
          </TypeWriter>
        ) : undefined}
        {processThreeTypingEnd ? (
          <TypeWriter
            pending={!processThreeDone}
            onTypingEnd={handleProcessFourTypingEnd}
          >
            <TypeWriter.NormalText fadeOut={processFourDone}>
              Backing up to <TypeWriter.Highlight>iCloud</TypeWriter.Highlight>
            </TypeWriter.NormalText>
          </TypeWriter>
        ) : undefined}
        {processFourTypingEnd ? (
          <TypeWriter
            pending={!processFourDone}
            onTypingEnd={handleAllTypingEnd}
          >
            <TypeWriter.Highlight>
              Your wallet is now ready. 🚀
            </TypeWriter.Highlight>
          </TypeWriter>
        ) : undefined}
        {allTypingEnd && <TypeWriter />}
      </Layout>
      <PinPanel />
    </>
  );
};

BehindTheScene.defaultProps = defaultProps;

export default BehindTheScene;
