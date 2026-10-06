import { readFile, mkdir, writeFile } from 'node:fs/promises';

const source = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const shared = source.slice(source.indexOf('const crowdCache ='), source.indexOf('export function makeServer()'));
if (!shared.includes('export async function getRegionWeather')) throw new Error('Server extraction failed');
const handler = `
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey,content-type', 'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const publishable = 'sb_publishable_example_for_course_submission';
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  // Only public, read-only place/weather data; private photo data never goes through this gateway.
  if (request.headers.get('apikey') !== publishable) return new Response(JSON.stringify({error:'허용되지 않은 요청이에요.'}), {status:403,headers});
  if (request.method !== 'GET') return new Response('{}', {status:405,headers});
  const url = new URL(request.url);
  let result;
  try {
    if (url.pathname.endsWith('/api/weather')) result = await getRegionWeather(url.searchParams.get('region'), Deno.env.get('KMA_SERVICE_KEY'));
    else if (url.pathname.endsWith('/api/origins')) result = await searchOrigins(url.searchParams.get('query'), Deno.env.get('KAKAO_REST_API_KEY'));
    else if (url.pathname.endsWith('/api/location-region')) result = await lookupRegionFromCoords(url.searchParams.get('lat'),url.searchParams.get('lng'),Deno.env.get('KAKAO_REST_API_KEY'));
    else if (url.pathname.endsWith('/api/crowd')) result = await getSeoulCrowdForSpot(url.searchParams.get('spotId'),Deno.env.get('SEOUL_OPEN_DATA_API_KEY'));
    else result = {status:404,body:{error:'찾을 수 없는 기능이에요.'}};
  } catch { result = {status:502,body:{error:'잠시 후 다시 시도해 주세요.'}}; }
  return new Response(JSON.stringify(result.body), {status:result.status,headers});
});
`;
await mkdir(new URL('../supabase/functions/moa-public-api/', import.meta.url), { recursive: true });
await writeFile(new URL('../supabase/functions/moa-public-api/index.ts', import.meta.url), shared + handler);
console.log('Generated public gateway from tested server helpers; no local secrets copied.');
