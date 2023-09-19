function getConfidenceInfoLevel(confidence: number) {
  if (confidence > 90) {
    return 0;
  }
  if (confidence >= 80 && confidence <= 90) {
    return 1;
  }
  return 2;
}

export { getConfidenceInfoLevel };
