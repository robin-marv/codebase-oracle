#!/usr/bin/env node
import ora from 'ora';
import { resolveApiKey } from './auth.js';
import { fetchRepoData } from './fetch.js';
import { analyzeRepo } from './analyze.js';
import { renderReading } from './render.js';

async function main(): Promise<void> {
  const repoArg = process.argv[2];

  if (!repoArg || repoArg === '--help' || repoArg === '-h') {
    console.log('');
    console.log('  Usage: oracle <github-repo-url>');
    console.log('');
    console.log('  Examples:');
    console.log('    oracle https://github.com/vercel/next.js');
    console.log('    oracle facebook/react');
    console.log('    oracle owner/repo');
    console.log('');
    console.log('  Requirements:');
    console.log('    • gh CLI installed and authenticated (github.com/cli/cli)');
    console.log('    • ANTHROPIC_API_KEY env var set, or paste it when prompted');
    console.log('');
    process.exit(repoArg ? 0 : 1);
  }

  const apiKey = await resolveApiKey();

  const fetchSpinner = ora({ text: 'Reading the repository...', color: 'magenta' }).start();
  let repo;
  try {
    repo = await fetchRepoData(repoArg);
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
}

main().catch(e => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
