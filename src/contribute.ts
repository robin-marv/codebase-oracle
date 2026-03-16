import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import prompts from 'prompts';
import type { OracleReading } from './analyze.js';
import type { RepoData } from './fetch.js';

const ORACLE_REPO = 'robin-marv/codebase-oracle';
const ORACLE_REPO_URL = `https://github.com/${ORACLE_REPO}`;

export interface SampleEntry {
  repo: string;
  description: string | null;
  language: string | null;
  stars: number;
  submittedAt: string;
  reading: OracleReading;
}

function gh(args: string): string {
  try {
    return execSync(`gh ${args}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e: unknown) {
    const err = e as { stderr?: string; message?: string };
    throw new Error(err.stderr || err.message || String(e));
  }
}

function sampleFilename(owner: string, name: string): string {
  return `${owner}-${name}.json`.toLowerCase().replace(/[^a-z0-9\-_.]/g, '-');
}

export function buildSample(repo: RepoData, reading: OracleReading): SampleEntry {
  return {
    repo: `${repo.owner}/${repo.name}`,
    description: repo.description,
    language: repo.language,
    stars: repo.stars,
    submittedAt: new Date().toISOString().slice(0, 10),
    reading,
  };
}

/**
 * Saves the reading to a local JSON file in ./samples/.
 * Returns the path it was written to.
 */
export function saveLocally(repo: RepoData, reading: OracleReading, outDir = './samples'): string {
  const sample = buildSample(repo, reading);
  const filename = sampleFilename(repo.owner, repo.name);
  const outPath = join(outDir, filename);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, JSON.stringify(sample, null, 2) + '\n');
  return outPath;
}

/**
 * Submits the reading as a pull request to the oracle gallery.
 * Uses gh API calls only — no cloning required.
 */
export async function contributePR(repo: RepoData, reading: OracleReading): Promise<void> {
  // Preflight: gh must be installed
  try {
    execSync('gh --version', { stdio: 'ignore' });
  } catch {
    throw new Error(
      'gh CLI is required to contribute. Install it at https://cli.github.com and then try again.'
    );
  }

  // Preflight: gh must be authenticated
  let isAuthed = false;
  try {
    execSync('gh auth status', { stdio: 'ignore' });
    isAuthed = true;
  } catch {
    // not authenticated
  }

  if (!isAuthed) {
    console.log('');
    const { doLogin } = await prompts({
      type: 'confirm',
      name: 'doLogin',
      message: "You're not logged into GitHub. Log in now with gh auth login?",
      initial: true,
    });

    if (!doLogin) {
      console.log('');
      console.log('  Skipping contribution. Run `gh auth login` when ready and try again.');
      console.log('');
      return;
    }

    try {
      execSync('gh auth login', { stdio: 'inherit' });
    } catch {
      throw new Error('Authentication failed. Run `gh auth login` manually and try again.');
    }
  }

  const sample = buildSample(repo, reading);
  const filename = sampleFilename(repo.owner, repo.name);
  const content = Buffer.from(JSON.stringify(sample, null, 2) + '\n').toString('base64');
  const filePath = `samples/${filename}`;
  const nwo = `${repo.owner}/${repo.name}`;
  const branchName = `sample/${repo.owner}-${repo.name}`.toLowerCase().replace(/[^a-z0-9\-/]/g, '-');

  console.log('');
  console.log('  Preparing your contribution...');

  // 1. Get the authenticated user
  const viewer = JSON.parse(gh(`api user --jq '{login: .login}'`));
  const forkOwner: string = viewer.login;
  const forkNwo = `${forkOwner}/codebase-oracle`;

  // 2. Ensure the fork exists (idempotent)
  console.log(`  Forking ${ORACLE_REPO} to ${forkNwo}...`);
  try {
    gh(`api repos/${ORACLE_REPO}/forks --method POST --field organization=''`);
  } catch {
    // Fork may already exist — that's fine
  }

  // Small delay to let GitHub provision the fork
  await new Promise(r => setTimeout(r, 3000));

  // 3. Get the current SHA of main on the oracle repo (source of truth, not the fork)
  // Note: `gh api --jq` outputs string scalars as raw (unquoted) text, not JSON.
  // Using JSON.parse here would fail on a hex SHA like "57bfd2..." (parses "57" as a
  // number, then errors on "b" at position 2). Just trim the trailing newline instead.
  const mainSha: string = gh(`api repos/${ORACLE_REPO}/git/ref/heads/main --jq '.object.sha'`).trim();

  // 4. Create (or reset) the branch on the fork
  try {
    gh(`api repos/${forkNwo}/git/refs --method POST --field ref='refs/heads/${branchName}' --field sha='${mainSha}'`);
  } catch {
    // Branch exists — update it
    try {
      gh(`api repos/${forkNwo}/git/refs/heads/${branchName} --method PATCH --field sha='${mainSha}' --field force=true`);
    } catch {
      // Ignore
    }
  }

  // 5. Check if file already exists (to get its SHA for update)
  let existingSha: string | undefined;
  try {
    // Same raw-string caveat as mainSha above — no JSON.parse needed.
    existingSha = gh(`api repos/${forkNwo}/contents/${filePath}?ref=${branchName} --jq '.sha'`).trim();
  } catch {
    // File doesn't exist yet — that's expected
  }

  // 6. Create or update the file on the branch
  console.log(`  Committing sample to branch ${branchName}...`);
  const commitArgs = [
    `api repos/${forkNwo}/contents/${filePath}`,
    `--method PUT`,
    `--field message='feat: add sample for ${nwo}'`,
    `--field content='${content}'`,
    `--field branch='${branchName}'`,
    existingSha ? `--field sha='${existingSha}'` : '',
  ].filter(Boolean).join(' ');
  gh(commitArgs);

  // 7. Open the PR
  console.log(`  Opening pull request...`);
  const prBody = [
    `Submitting a reading for [${nwo}](https://github.com/${nwo}).`,
    ``,
    `**Archetype:** ${reading.archetype}`,
    ``,
    `> ${reading.verdict.slice(0, 280)}${reading.verdict.length > 280 ? '…' : ''}`,
    ``,
    `_Generated by [codebase-oracle](${ORACLE_REPO_URL})_`,
  ].join('\n');

  const pr = JSON.parse(gh(
    `api repos/${ORACLE_REPO}/pulls --method POST ` +
    `--field title='feat: add sample for ${nwo}' ` +
    `--field head='${forkOwner}:${branchName}' ` +
    `--field base='main' ` +
    `--field body=${JSON.stringify(prBody)}`
  ));

  console.log('');
  console.log(`  ✓ Pull request opened: ${pr.html_url}`);
  console.log('');
}

/**
 * Prompts the user after a reading to optionally save and/or contribute.
 */
export async function promptContribution(repo: RepoData, reading: OracleReading): Promise<void> {
  console.log('');
  const { action } = await prompts({
    type: 'select',
    name: 'action',
    message: 'Want to do anything with this reading?',
    choices: [
      { title: 'Contribute to the gallery (opens a PR)', value: 'contribute' },
      { title: 'Save locally as JSON', value: 'save' },
      { title: 'Nothing, thanks', value: 'none' },
    ],
    initial: 0,
  });

  if (action === 'contribute') {
    await contributePR(repo, reading);
  } else if (action === 'save') {
    const path = saveLocally(repo, reading);
    console.log('');
    console.log(`  ✓ Saved to ${path}`);
    console.log('');
  }
}
