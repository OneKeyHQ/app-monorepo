export async function downloadAsFile({
  content,
  filename,
  encoding = 'utf8',
  mimeType = 'application/json',
}: {
  content: string;
  filename: string;
  encoding?: 'utf8' | 'base64';
  mimeType?: string;
  UTI?: string;
}): Promise<void> {
  const element = document.createElement('a');
  const data =
    encoding === 'base64'
      ? new Uint8Array(Buffer.from(content, 'base64'))
      : content;
  const file = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(file);
  element.href = url;
  element.download = filename;
  document.body.appendChild(element);
  try {
    element.click();
  } finally {
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  }
}
