import makeBlockie from 'ethereum-blockies-base64';

export default function makeBlockieImageUri(id: string) {
  return new Promise<string>((resolve) => {
    const data = makeBlockie(id);
    resolve(data);
  });
}
