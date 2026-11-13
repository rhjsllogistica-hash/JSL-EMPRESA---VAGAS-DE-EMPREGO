import { handleApiRequest } from '../../src/server/apiHandler.ts';
import { WorkerEnv } from '../../src/server/d1Types.ts';

interface PagesContext {
  request: Request;
  env: WorkerEnv;
}

export async function onRequest(context: PagesContext): Promise<Response> {
  return handleApiRequest(context.request, context.env);
}
