#!/usr/bin/env node
import ora from 'ora';
import { resolveApiKey } from './auth.js';
import { fetchRepoData } from './fetch.js';
import { analyzeRepo } from './analyze.js';
import { renderReading } from './render.js';
import { saveLocally, contributePR, promptContribution } from './contribute.js';

const args = process.argv.slice(2);
const repoArg = args.find(a => !a.startsWith('-'));
const flagSave = args.includes('--save');
const flagContribute = args.includes('--contribute');
const flagHelp = args.includes('--help') || args.includes('-h');

if (flagHelp || !repoArg) {
  console.log('');
  console.log('  Usage: oracle <github-repo-url> [options]');
  console.log('');
  console.log('  Examples:');
  console.log('    oracle https://github.com/vercel/next.js');
  console.log('    oracle facebook/react');
  console.log('    oracle owner/repo --contribute');
  console.log('');
  console.log('  Options:');
  console.log('    --save         Save the reading as JSON in ./samples/');
  console.log('    --contribute   Submit the reading as a PR to the gallery');
  console.log('    --help, -h     Show this help message');
  console.log('');
  console.log('  Requirements:');
  console.log('    • gh CLI installed and authenticated (github.com/cli/cli)');
  console.log('    • ANTHROPIC_API_KEY env var set, or paste it when prompted');
  console.log('');
  process.exit(repoArg ? 0 : 1);
}

async function main(): Promise<void> {
  const apiKey = await resolveApiKey();

  const fetchSpinner = ora({ text: 'Reading the repository...', color: 'magenta' }).start();
  let repo;
  try {
    repo = await fetchRepoData(repoArg!);
    fetchSpinner.succeed(`Fetched ${repo.owner}/${repo.name} — ${repo.fileTree.length} files, ${repo.commits.length} commits`);
  } catch (e: unknown) {
    const err = e as Error;
    fetchSpinner.fail(`Failed to fetch repo: ${err.message}`);
    console.error('');
    console.error('Make sure:');
    console.error('  • The repo exists and is accessible to your gh account');
    console.error('  • gh is authenticated: gh auth status');
    process.exit(1);
  }

  const analyzeSpinner = ora({ text: 'Consulting the oracle...', color: 'magenta' }).start();
  let reading;
  try {
    reading = await analyzeRepo(repo, apiKey);
    analyzeSpinner.succeed('The oracle has spoken.');
  } catch (e: unknown) {
    const err = e as Error;
    analyzeSpinner.fail(`Oracle error: ${err.message}`);
    process.exit(1);
  }

  renderReading(repo, reading);

  if (flagSave) {
    const path = saveLocally(repo, reading);
    console.log(`  ✓ Saved to ${path}`);
    console.log('');
  }

  if (flagContribute) {
    await contributePR(repo, reading);
  } else if (!flagSave) {
    // Interactive prompt — only when neither flag was passed
    await promptContribution(repo, reading);
  }
}

main().catch(e => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
