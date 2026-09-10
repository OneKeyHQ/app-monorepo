export async function downloadAsFile({
  content,
  filename,
}: {
  content: string;
  filename: string;
}): Promise<void> {
  const element = document.createElement('a');
  const file = new Blob([content], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(file);
  element.href = url;
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  URL.revokeObjectURL(url);
}
