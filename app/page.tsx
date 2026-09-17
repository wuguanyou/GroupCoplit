import { chatGPTSignInPath } from './chatgpt-auth';
import { WorkspaceGate } from '../components/workspace-gate';
export const dynamic = 'force-dynamic';
export default function Home() {
  return <WorkspaceGate signInPath={chatGPTSignInPath('/')} />;
}
