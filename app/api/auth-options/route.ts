import { publicAuthSettings } from '../../../lib/auth';
export async function GET() {
  const { providers } = publicAuthSettings();
  return Response.json(
    { providers },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
