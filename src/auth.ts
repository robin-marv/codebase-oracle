import prompts from 'prompts';

/**
 * Resolves the Anthropic API key.
 * Checks ANTHROPIC_API_KEY env var first; if absent, prompts the user.
 * Does not persist the key — it lives only for this session.
 */
export async function resolveApiKey(): Promise<string> {
  const fromEnv = process.env.ANTHROPIC_API_KEY;
  if (fromEnv) return fromEnv;

  console.log('');
  console.log('No ANTHROPIC_API_KEY found in environment.');
  console.log('You can set it permanently with:');
  console.log('  export ANTHROPIC_API_KEY=sk-ant-...');
  console.log('');

  const { key } = await prompts({
    type: 'password',
    name: 'key',
    message: 'Paste your Anthropic API key to continue (not saved):',
    validate: (v: string) => v.startsWith('sk-ant-') ? true : 'Doesn\'t look like an Anthropic key (should start with sk-ant-)',
  });

  if (!key) {
    console.error('No key provided. Exiting.');
    process.exit(1);
  }

  return key;
}
