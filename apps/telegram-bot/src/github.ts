const GITHUB_API = 'https://api.github.com';
const INPUT_FILE_PATH = '(input)/input.md';

const headers = (token: string) => ({
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  Authorization: `Bearer ${token}`,
  'User-Agent': 'markcards',
  'Content-Type': 'application/json',
});

export async function getFileContent(
  owner: string,
  repo: string,
  filePath: string,
  token: string,
): Promise<string | null> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}?ref=main`, {
    headers: headers(token),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { content: string };
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

export async function appendOrCreateFile(
  owner: string,
  repo: string,
  filePath: string,
  token: string,
  cardsMarkdown: string,
): Promise<{ url: string; created: boolean }> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`;

  // Try to fetch existing file
  const getRes = await fetch(`${url}?ref=main`, { headers: headers(token) });
  if (!getRes.ok && getRes.status !== 404) {
    throw new Error(`GitHub GET failed: ${getRes.status} ${await getRes.text()}`);
  }

  let content: string;
  let sha: string | undefined;
  let created: boolean;

  if (getRes.status === 404) {
    content = cardsMarkdown;
    created = true;
  } else {
    const existing = (await getRes.json()) as { content: string; sha: string };
    sha = existing.sha;
    const decoded = Buffer.from(existing.content, 'base64').toString('utf-8');
    content = `${decoded.trimEnd()}\n\n---\n\n${cardsMarkdown}`;
    created = false;
  }

  const body: Record<string, string> = {
    message: created ? `Add ${filePath}` : `Append cards to ${filePath}`,
    content: Buffer.from(content).toString('base64'),
    branch: 'main',
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(body),
  });

  if (!putRes.ok) {
    throw new Error(`GitHub PUT failed: ${putRes.status} ${await putRes.text()}`);
  }

  const data = (await putRes.json()) as { commit: { html_url: string } };
  return { url: data.commit.html_url, created };
}

export async function uploadFile(
  owner: string,
  repo: string,
  branch: string,
  token: string,
  filePath: string,
  content: ArrayBuffer,
): Promise<void> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`;
  const hdrs = headers(token);

  const getRes = await fetch(`${url}?ref=${branch}`, { headers: hdrs });
  let sha: string | undefined;
  if (getRes.ok) {
    sha = ((await getRes.json()) as { sha: string }).sha;
  }

  const body: Record<string, string> = {
    message: `Add ${filePath}`,
    content: Buffer.from(content).toString('base64'),
    branch,
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(url, { method: 'PUT', headers: hdrs, body: JSON.stringify(body) });
  if (!putRes.ok) throw new Error(`GitHub PUT failed: ${putRes.status} ${await putRes.text()}`);
}

export async function appendToInputFile(
  owner: string,
  repo: string,
  branch: string,
  token: string,
  basePath: string,
  blocks: Array<{ path: string; cardMarkdown: string }>,
): Promise<void> {
  if (blocks.length === 0) return;

  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${INPUT_FILE_PATH}`;
  const hdrs = headers(token);

  const getRes = await fetch(`${url}?ref=${branch}`, { headers: hdrs });
  if (!getRes.ok && getRes.status !== 404) {
    throw new Error(`GitHub GET failed: ${getRes.status} ${await getRes.text()}`);
  }

  const newBlocks = blocks
    .map(({ path, cardMarkdown }) => `# path: ${basePath ? `${basePath}/${path}` : path}\n\n${cardMarkdown}`)
    .join('\n---\n');

  let content: string;
  let sha: string | undefined;

  if (getRes.status === 404) {
    content = newBlocks;
  } else {
    const existing = (await getRes.json()) as { content: string; sha: string };
    sha = existing.sha;
    const decoded = Buffer.from(existing.content, 'base64').toString('utf-8');
    content = `${decoded.trimEnd()}\n---\n${newBlocks}`;
  }

  const body: Record<string, string> = {
    message: `Add ${blocks.length} card(s) to input`,
    content: Buffer.from(content).toString('base64'),
    branch,
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: hdrs,
    body: JSON.stringify(body),
  });

  if (!putRes.ok) {
    throw new Error(`GitHub PUT failed: ${putRes.status} ${await putRes.text()}`);
  }
}
