import { env } from 'cloudflare:workers';
import { configStatus, getAIConfig, type AIEnvironment } from './ai-provider';
export const aiConfig = () => getAIConfig(env as unknown as AIEnvironment);
export function aiStatus() {
  try {
    return { ...configStatus(aiConfig()), verified: false };
  } catch {
    return {
      configured: false,
      missing: ['修正後端 AI 設定'],
      model: '',
      protocol: 'chat',
      dailyLimit: 0,
      verified: false,
    };
  }
}
export const aiReady = () => aiStatus().configured;
