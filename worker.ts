import app from 'vinext/server/fetch-handler';
import { runProjectMonitor } from './lib/project-monitor';

export default {
  ...app,
  async scheduled(controller: ScheduledController, env: { DB: D1Database }) {
    await runProjectMonitor(env.DB, new Date(controller.scheduledTime).toISOString());
  },
};
