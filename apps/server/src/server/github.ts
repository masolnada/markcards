export interface GitHubConfig {
  owner: string;
  repo: string;
  branch: string;
  path: string;        // subdirectory prefix, e.g. "decks" or ""
  token?: string;
}

export interface GitHubFile {
  virtualPath: string; // e.g. "github:owner/repo/decks/sample.md"
  content: string;     // raw markdown
}

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'markcards',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function fetchGitHubDecks(cfg: GitHubConfig): Promise<GitHubFile[]> {
  const { owner, repo, branch, path: pathPrefix, token } = cfg;
  const headers = buildHeaders(token);

  // 1. Fetch the full recursive tree
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const treeRes = await fetch(treeUrl, { headers });
  if (!treeRes.ok) {
    const body = await treeRes.text();
    throw new Error(`GitHub tree API error ${treeRes.status}: ${body}`);
  }
  const tree = await treeRes.json() as { tree: Array<{ path: string; type: string }> };

  // 2. Filter to .md files under the configured path prefix
  const mdFiles = tree.tree.filter(item => {
    if (item.type !== 'blob') return false;
    if (!item.path.endsWith('.md')) return false;
    if (pathPrefix && !item.path.startsWith(pathPrefix + '/') && item.path !== pathPrefix) return false;
    return true;
  });

  if (mdFiles.length === 0) return [];

  // 3. Fetch each file's content
  const results: GitHubFile[] = [];
  for (const file of mdFiles) {
    const contentsUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`;
    const contentRes = await fetch(contentsUrl, { headers });
    if (!contentRes.ok) {
      console.warn(`GitHub: failed to fetch ${file.path} (${contentRes.status}), skipping`);
      continue;
    }
    const data = await contentRes.json() as { content?: string; encoding?: string };
    if (data.encoding !== 'base64' || !data.content) {
      console.warn(`GitHub: unexpected encoding for ${file.path}, skipping`);
      continue;
    }
    const raw = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
    results.push({
      virtualPath: `github:${owner}/${repo}/${file.path}`,
      content: raw,
    });
  }

  return results;
}
