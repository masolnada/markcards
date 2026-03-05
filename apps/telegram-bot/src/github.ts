const GITHUB_API = 'https://api.github.com';

const headers = (token: string) => ({
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  Authorization: `Bearer ${token}`,
  'User-Agent': 'markcards',
  'Content-Type': 'application/json',
});

export async function appendOrCreateFile(
  owner: string,
  repo: string,
  filePath: string,
  token: string,
  cardsMarkdown: string,
  deckName: string,
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
    content = `---\nname = "${deckName}"\n---\n\n${cardsMarkdown}`;
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
