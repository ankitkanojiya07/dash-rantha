import { agentMatchKey } from '../utils/agentName.js';

/**
 * Map agent display names → recipient emails.
 * Keys are matched case-insensitively via agentMatchKey (handles minor spelling variants).
 * Fill in real addresses for each agent you want to email.
 */
const AGENT_EMAILS: Record<string, string> = {
  'Distinct Destination': '',
  Sita: '',
  Jayasree: '',
  TBI: '',
  Eatrails: '',
  DRT: '',
  'Nature Wanderers': '',
  Equonix: '',
  'Safari Crafters': '',
  'Booking.com': '',
  Travelscope: '',
  'Beyond Wild': '',
  'TFE Vacations': '',
  'Trans India Holidays': '',
  LPTI: '',
  Wildscape: '',
};

/** Also allow override via env: AGENT_EMAILS_JSON='{"Sita":"sita@example.com"}' */
function loadEnvOverrides(): Record<string, string> {
  const raw = process.env.AGENT_EMAILS_JSON;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && v.trim()) out[k] = v.trim();
    }
    return out;
  } catch {
    console.warn('Invalid AGENT_EMAILS_JSON — ignoring');
    return {};
  }
}

function buildLookup(): Map<string, string> {
  const map = new Map<string, string>();
  const merged = { ...AGENT_EMAILS, ...loadEnvOverrides() };
  for (const [name, email] of Object.entries(merged)) {
    if (!email?.trim()) continue;
    map.set(agentMatchKey(name), email.trim());
  }
  return map;
}

let cached: Map<string, string> | null = null;

function lookup(): Map<string, string> {
  if (!cached) cached = buildLookup();
  return cached;
}

export function getAgentEmail(agentName: string): string | null {
  const email = lookup().get(agentMatchKey(agentName));
  return email || null;
}

export function listConfiguredAgentEmails(): { agentName: string; email: string }[] {
  return Object.entries({ ...AGENT_EMAILS, ...loadEnvOverrides() })
    .filter(([, email]) => Boolean(email?.trim()))
    .map(([agentName, email]) => ({ agentName, email: email.trim() }));
}
