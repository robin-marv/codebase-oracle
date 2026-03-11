import { execSync } from 'child_process';

export interface RepoData {
  owner: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  createdAt: string;
  commits: CommitSummary[];
  fileTree: string[];
  sourceFiles: SourceFile[];
  pullRequests: PRSummary[];
}

export interface CommitSummary {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface SourceFile {
  path: string;
  content: string;
}

export interface PRSummary {
  title: string;
  body: string | null;
  state: string;
}

/** Extensions we consider "source" — skip generated, vendored, lock files, etc. */
const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rb', '.go', '.rs', '.java',
  '.kt', '.swift', '.c', '.cpp', '.h', '.cs', '.php', '.ex', '.exs',
  '.clj', '.scala', '.hs', '.ml', '.elm', '.vue', '.svelte', '.sol',
]);

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', 'vendor', 'coverage',
  '__pycache__', '.next', '.nuxt', 'out', 'target', 'bin', 'obj',
  '.cache', 'venv', 'env', '.venv',
]);

const SKIP_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Gemfile.lock',
  'poetry.lock', 'Cargo.lock', 'go.sum',
]);

function gh(args: string): string {
  try {
    return execSync(`gh ${args}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e: unknown) {
    const err = e as { stderr?: string; message?: string };
    throw new Error(err.stderr || err.message || String(e));
  }
}

function parseRepoUrl(url: string): { owner: string; name: string } {
  // Handles: https://github.com/owner/repo, github.com/owner/repo, owner/repo
  const match = url.replace(/^https?:\/\//, '').match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (match) return { owner: match[1], name: match[2] };

  const short = url.match(/^([^/]+)\/([^/]+)$/);
  if (short) return { owner: short[1], name: short[2] };

  throw new Error(`Can't parse repo URL: ${url}`);
}

export async function fetchRepoData(url: string): Promise<RepoData> {
  const { owner, name } = parseRepoUrl(url);
  const nwo = `${owner}/${name}`;

  // Repo metadata
  const meta = JSON.parse(gh(`api repos/${nwo} --jq '{description: .description, language: .language, stars: .stargazers_count, forks: .forks_count, createdAt: .created_at}'`));

  // Recent commits (last 60)
  const commitsRaw = JSON.parse(gh(`api repos/${nwo}/commits?per_page=60 --jq '[.[] | {hash: .sha[:7], message: .commit.message, author: .commit.author.name, date: .commit.author.date[:10]}]'`));
  const commits: CommitSummary[] = commitsRaw;

  // File tree via git trees API (recursive)
  const defaultBranch = JSON.parse(gh(`api repos/${nwo} --jq '.default_branch'`));
  const treeRaw = JSON.parse(gh(`api repos/${nwo}/git/trees/${defaultBranch}?recursive=1 --jq '[.tree[] | select(.type == "blob") | .path]'`));
  const allFiles: string[] = treeRaw;

  // Filter to source files
  const sourceFilePaths = allFiles.filter(f => {
    const parts = f.split('/');
    if (parts.some(p => SKIP_DIRS.has(p))) return false;
    if (SKIP_FILES.has(parts[parts.length - 1])) return false;
    const ext = f.slice(f.lastIndexOf('.'));
    return SOURCE_EXTENSIONS.has(ext);
  });

  // Sample up to 20 files, prioritising shorter paths (more likely to be core files)
  const sampled = sourceFilePaths
    .sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length)
    .slice(0, 20);

  // Fetch file contents (cap each at 6KB)
  const sourceFiles: SourceFile[] = [];
  for (const path of sampled) {
    try {
      const raw = gh(`api repos/${nwo}/contents/${path} --jq '.content'`).trim();
      // content is base64
      const content = Buffer.from(raw.replace(/"/g, '').replace(/\\n/g, ''), 'base64').toString('utf-8').slice(0, 6000);
      sourceFiles.push({ path, content });
    } catch {
      // file might be too large or binary; skip
    }
  }

  // PRs (last 20, public repos only — private repos may return 404)
  let pullRequests: PRSummary[] = [];
  try {
    pullRequests = JSON.parse(gh(`api repos/${nwo}/pulls?state=all&per_page=20 --jq '[.[] | {title: .title, body: .body, state: .state}]'`));
  } catch {
    // private repo or no PRs — fine, continue without
  }

  return {
    owner,
    name,
    description: meta.description,
    language: meta.language,
    stars: meta.stars,
    forks: meta.forks,
    createdAt: meta.createdAt,
    commits,
    fileTree: allFiles,
    sourceFiles,
    pullRequests,
  };
}
