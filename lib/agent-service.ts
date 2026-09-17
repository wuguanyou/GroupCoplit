import { readProject, saveProject } from '../db/store';
import { getRun, listRuns, reserveRun, finishRun } from '../db/agent-store';
import { aiConfig } from './ai';
import { generateJSON } from './ai-provider';
import { createAgentService } from './agent-runner';
export const { handleAgent, applyRun } = createAgentService({
  readProject,
  saveProject,
  getRun,
  listRuns,
  reserveRun,
  finishRun,
  aiConfig,
  generateJSON,
});
