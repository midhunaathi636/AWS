import serverlessExpress from '@vendia/serverless-express';
import { app } from '../server.js';

const proxy = serverlessExpress({ app });
export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  return proxy(event, context);
};
