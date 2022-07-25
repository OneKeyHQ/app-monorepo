/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { FC, useCallback, useState } from 'react';

import {
  Box,
  Button,
  PresenceTransition,
  TypeWriter,
} from '@onekeyhq/components';

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
  const [showLastAction, setIsShowLastAction] = useState(false);

  const handleProcessOneTypingEnd = useCallback(() => {
    setIsProcessOneTypingEnd(true);

    setTimeout(() => {
      setIsProcessOneDone(true);
    }, 1000);
  }, []);

  const handleProcessTwoTypingEnd = useCallback(() => {
    setIsProcessTwoTypingEnd(true);

    setTimeout(() => {
      setIsProcessTwoDone(true);
    }, 1000);
  }, []);

  const handleProcessThreeTypingEnd = useCallback(() => {
    setIsProcessThreeTypingEnd(true);

    setTimeout(() => {
      setIsProcessThreeDone(true);
    }, 1000);
  }, []);

  const handleProcessFourTypingEnd = useCallback(() => {
    setIsProcessFourTypingEnd(true);

    setTimeout(() => {
      setIsProcessFourDone(true);
    }, 1000);
  }, []);

  const handleAllTypingEnd = useCallback(() => {
    setIsAllTypingEnd(true);

    setTimeout(() => {
      setIsShowLastAction(true);
    }, 300);
  }, []);

  return (
    <>
      <Layout
        visible={visible}
        backButton={false}
        fullHeight
        // secondaryContent={
        //   showLastAction ? (
        //     <PresenceTransition
        //       as={Box}
        //       mt="auto"
        //       alignSelf={{ base: 'stretch', sm: 'flex-start' }}
        //       visible={showLastAction}
        //       initial={{ opacity: 0, scale: 0.95 }}
        //       animate={{ opacity: 1, scale: 1, transition: { duration: 150 } }}
        //     >
        //       <Button type="primary" size="xl">
        //         Let's go
        //       </Button>
        //     </PresenceTransition>
        //   ) : undefined
        // }
      >
        <Box minH={{ base: 480, sm: 320 }} justifyContent="flex-end">
          <TypeWriter
            onTypingEnd={handleProcessOneTypingEnd}
            isPending={false}
            fadeOut={processOneDone}
          >
            <TypeWriter.NormalText>Creating your</TypeWriter.NormalText>{' '}
            <TypeWriter.Highlight>wallet</TypeWriter.Highlight>
          </TypeWriter>
          {processOneTypingEnd ? (
            <TypeWriter
              isPending={!processOneDone}
              onTypingEnd={handleProcessTwoTypingEnd}
              fadeOut={processTwoDone}
            >
              <TypeWriter.NormalText>Generating your</TypeWriter.NormalText>{' '}
              <TypeWriter.Highlight>accounts</TypeWriter.Highlight>
            </TypeWriter>
          ) : undefined}
          {processTwoTypingEnd ? (
            <TypeWriter
              isPending={!processTwoDone}
              fadeOut={processThreeDone}
              onTypingEnd={handleProcessThreeTypingEnd}
            >
              <TypeWriter.NormalText>Verifying your</TypeWriter.NormalText>{' '}
              <TypeWriter.Highlight>key</TypeWriter.Highlight>
            </TypeWriter>
          ) : undefined}
          {processThreeTypingEnd ? (
            <TypeWriter
              isPending={!processThreeDone}
              fadeOut={processFourDone}
              onTypingEnd={handleProcessFourTypingEnd}
            >
              <TypeWriter.NormalText>Backing up to</TypeWriter.NormalText>{' '}
              <TypeWriter.Highlight>iCloud</TypeWriter.Highlight>
            </TypeWriter>
          ) : undefined}
          {processFourTypingEnd ? (
            <TypeWriter
              isPending={!processFourDone}
              onTypingEnd={handleAllTypingEnd}
            >
              <TypeWriter.NormalText>
                Your wallet is now{' '}
                <TypeWriter.Highlight>ready</TypeWriter.Highlight>. 🚀
              </TypeWriter.NormalText>
            </TypeWriter>
          ) : undefined}
          {allTypingEnd ? <TypeWriter /> : undefined}
        </Box>
      </Layout>
      {/* {showLastAction ? <PinPanel visible={showLastAction} /> : undefined} */}
    </>
  );
};

BehindTheScene.defaultProps = defaultProps;

export default React.memo(BehindTheScene);
