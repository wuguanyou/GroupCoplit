import { access, owner, apiError } from './access';
import { readProject, saveProject } from '../db/store';
import { getRun, listRuns, reserveRun, finishRun } from '../db/agent-store';
import { aiConfig } from './ai';
import { generateJSON } from './ai-provider';
import { createAgentService } from './agent-runner';
const service = createAgentService({
  readProject,
  saveProject,
  getRun,
  listRuns,
  reserveRun,
  finishRun,
  aiConfig,
  generateJSON,
});

export async function handleAgent(request: Request) {
  try {
    const a = await access();
    if (request.method !== 'GET') owner(a.role);
    return service.handleAgent(request);
  } catch (e) {
    return apiError(e);
  }
}
