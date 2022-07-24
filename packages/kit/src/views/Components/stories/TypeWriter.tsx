import React, { useState } from 'react';

import { Center, TypeWriter } from '@onekeyhq/components';

const TypeWriterGallery = () => {
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
    <Center flex="1" bg="background-hovered">
      <TypeWriter
        onTypingEnd={handleProcessOneTypingEnd}
        isPending={false}
        fadeOut={processOneDone}
      >
        <TypeWriter.NormalText>Creating your</TypeWriter.NormalText>{' '}
        <TypeWriter.Highlight>wallet</TypeWriter.Highlight>
      </TypeWriter>
      {processOneTypingEnd && (
        <TypeWriter
          isPending={!processOneDone}
          onTypingEnd={handleProcessTwoTypingEnd}
          fadeOut={processTwoDone}
        >
          <TypeWriter.NormalText>Generating your</TypeWriter.NormalText>{' '}
          <TypeWriter.Highlight>accounts</TypeWriter.Highlight>
        </TypeWriter>
      )}
      {processTwoTypingEnd && (
        <TypeWriter
          isPending={!processTwoDone}
          fadeOut={processThreeDone}
          onTypingEnd={handleProcessThreeTypingEnd}
        >
          <TypeWriter.NormalText>Verifying your</TypeWriter.NormalText>{' '}
          <TypeWriter.Highlight>key</TypeWriter.Highlight>
        </TypeWriter>
      )}
      {processThreeTypingEnd && (
        <TypeWriter
          isPending={!processThreeDone}
          fadeOut={processFourDone}
          onTypingEnd={handleProcessFourTypingEnd}
        >
          <TypeWriter.NormalText>Backing up to</TypeWriter.NormalText>{' '}
          <TypeWriter.Highlight>iCloud</TypeWriter.Highlight>
        </TypeWriter>
      )}
      {processFourTypingEnd && (
        <TypeWriter
          isPending={!processFourDone}
          onTypingEnd={handleAllTypingEnd}
        >
          <TypeWriter.Highlight>
            Your wallet is now ready. 🚀
          </TypeWriter.Highlight>
        </TypeWriter>
      )}
      {allTypingEnd && <TypeWriter />}
    </Center>
  );
};

export default TypeWriterGallery;
