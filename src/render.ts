import chalk from 'chalk';
import type { OracleReading } from './analyze.js';
import type { RepoData } from './fetch.js';

const SEPARATOR = chalk.dim('─'.repeat(60));

function wrap(text: string, indent = 0): string {
  const width = Math.min(process.stdout.columns || 80, 80) - indent;
  const pad = ' '.repeat(indent);
  return text
    .split('\n')
    .flatMap(line => {
      if (line.length <= width) return [pad + line];
      const words = line.split(' ');
      const lines: string[] = [];
      let current = '';
      for (const word of words) {
        if ((current + ' ' + word).trim().length > width) {
          if (current) lines.push(pad + current.trim());
          current = word;
        } else {
          current = current ? current + ' ' + word : word;
        }
      }
      if (current) lines.push(pad + current.trim());
      return lines;
    })
    .join('\n');
}

export function renderReading(repo: RepoData, reading: OracleReading): void {
  console.log('');
  console.log(SEPARATOR);
  console.log('');
  console.log(chalk.bold.magenta('  ◈  THE CODEBASE ORACLE  ◈'));
  console.log('');
  console.log(chalk.dim(`  ${repo.owner}/${repo.name}`));
  console.log(chalk.bold.white(`  ${reading.archetype}`));
  console.log('');
  console.log(SEPARATOR);

  // Core Character
  console.log('');
  console.log(chalk.bold.cyan('  CORE CHARACTER'));
  console.log('');
  console.log(wrap(reading.coreCharacter, 2));

  // Strengths
  console.log('');
  console.log(SEPARATOR);
  console.log('');
  console.log(chalk.bold.green('  STRENGTHS'));
  console.log('');
  for (const strength of reading.strengths) {
    console.log(wrap(`+ ${strength}`, 2));
    console.log('');
  }

  // Tensions
  console.log(SEPARATOR);
  console.log('');
  console.log(chalk.bold.yellow('  TENSIONS'));
  console.log('');
  for (const tension of reading.tensions) {
    console.log(wrap(`± ${tension}`, 2));
    console.log('');
  }

  // Commit Autopsy
  console.log(SEPARATOR);
  console.log('');
  console.log(chalk.bold.red('  COMMIT AUTOPSY'));
  console.log('');
  console.log(wrap(reading.commitAutopsy, 2));

  // Verdict
  console.log('');
  console.log(SEPARATOR);
  console.log('');
  console.log(chalk.bold.white('  THE VERDICT'));
  console.log('');
  console.log(wrap(reading.verdict, 2));
  console.log('');
  console.log(SEPARATOR);
  console.log('');
}
