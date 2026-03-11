import Anthropic from '@anthropic-ai/sdk';
import type { RepoData } from './fetch.js';

export interface OracleReading {
  coreCharacter: string;
  strengths: string[];
  tensions: string[];
  commitAutopsy: string;
  verdict: string;
  archetype: string;
}

function buildPrompt(repo: RepoData): string {
  const commitSample = repo.commits
    .slice(0, 40)
    .map(c => `  [${c.date}] ${c.author}: ${c.message.split('\n')[0]}`)
    .join('\n');

  const prSample = repo.pullRequests
    .slice(0, 15)
    .map(p => `  [${p.state}] ${p.title}${p.body ? `\n    ${p.body.slice(0, 200).replace(/\n/g, ' ')}` : ''}`)
    .join('\n');

  const fileSample = repo.sourceFiles
    .map(f => `\n--- ${f.path} ---\n${f.content.slice(0, 3000)}`)
    .join('\n');

  const fileTreeSummary = summariseTree(repo.fileTree);

  return `You are the Codebase Oracle — an entity that reads the soul of a software project.

You've been given access to the following repository:

REPO: ${repo.owner}/${repo.name}
DESCRIPTION: ${repo.description ?? 'none'}
PRIMARY LANGUAGE: ${repo.language ?? 'unknown'}
CREATED: ${repo.createdAt.slice(0, 10)}
STARS: ${repo.stars} | FORKS: ${repo.forks}

FILE STRUCTURE SUMMARY:
${fileTreeSummary}

RECENT COMMITS (oldest to newest, first 40):
${commitSample || '  (none available)'}

PULL REQUESTS:
${prSample || '  (none available)'}

SOURCE FILE SAMPLES:
${fileSample || '  (none available)'}

---

Based on all of the above, produce a personality profile of this codebase. This is not a technical audit — it's a character reading. Be specific, be honest, be a little dramatic when warranted.

Respond with a JSON object matching this exact structure:
{
  "archetype": "A 2-4 word archetype label (e.g. 'The Anxious Perfectionist', 'The Pragmatic Cowboy', 'The Careful Academic')",
  "coreCharacter": "2-3 paragraphs. The essential nature of this codebase — its personality, what it values, what it fears, how it thinks. Be specific and reference actual things you saw.",
  "strengths": ["3-5 genuine strengths, each 1-2 sentences. Reference specifics."],
  "tensions": ["2-4 tensions or contradictions you noticed. Things the codebase wants to be vs what it actually is. Each 1-2 sentences."],
  "commitAutopsy": "Pick the single most revealing commit message or PR title you saw and do a 2-3 sentence character analysis of what it says about the team.",
  "verdict": "One punchy paragraph. The bottom line on this codebase — what would it be like to work here, what does it tell you about the people who built it?"
}

Only output valid JSON. No preamble, no commentary outside the JSON.`;
}

function summariseTree(files: string[]): string {
  // Count files per top-level directory
  const counts: Record<string, number> = {};
  for (const f of files) {
    const top = f.split('/')[0];
    counts[top] = (counts[top] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([dir, count]) => `  ${dir}/ (${count} files)`)
    .join('\n');
}

export async function analyzeRepo(repo: RepoData, apiKey: string): Promise<OracleReading> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: buildPrompt(repo),
      },
    ],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';

  // Strip any markdown code fences if the model wrapped the JSON
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/) || [null, raw];
  const jsonStr = (jsonMatch[1] || raw).trim();

  try {
    return JSON.parse(jsonStr) as OracleReading;
  } catch {
    throw new Error(`Oracle returned malformed JSON:\n${raw.slice(0, 500)}`);
  }
}
