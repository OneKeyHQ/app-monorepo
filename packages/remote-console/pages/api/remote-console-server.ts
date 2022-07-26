/* eslint-disable  */
// @ts-nocheck
// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import server from '../../src/server.mjs';
import type { NextApiRequest, NextApiResponse } from 'next';

type Data = {
  name: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  res.status(200).json({ message: server.msg });
}
