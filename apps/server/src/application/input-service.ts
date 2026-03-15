import { parseInputFile, removeInputCard } from '../infrastructure/input-parser.js';
import type { InputCard } from '../infrastructure/input-parser.js';

const GITHUB_API = 'https://api.github.com';

interface GitHubCfg {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  basePath: string;
}

const INPUT_FILE_PATH = '(input)/input.md';

function buildHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'markcards',
    'Content-Type': 'application/json',
  };
}

async function getFile(cfg: GitHubCfg, filePath: string): Promise<{ content: string; sha: string } | null> {
  const { owner, repo, branch, token } = cfg;
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
  const res = await fetch(url, { headers: buildHeaders(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { content: string; sha: string };
  const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
  return { content, sha: data.sha };
}

async function putFile(cfg: GitHubCfg, filePath: string, content: string, sha: string | undefined, message: string): Promise<void> {
  const { owner, repo, branch, token } = cfg;
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`;
  const body: Record<string, string> = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch,
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, { method: 'PUT', headers: buildHeaders(token), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`GitHub PUT failed: ${res.status} ${await res.text()}`);
}

export class InputService {
  constructor(private cfg: GitHubCfg) {}

  async getInputCards(): Promise<{ cards: InputCard[] }> {
    const file = await getFile(this.cfg, INPUT_FILE_PATH);
    if (!file) return { cards: [] };
    return { cards: parseInputFile(file.content) };
  }

  async confirmCard(cardId: string, markdown?: string): Promise<void> {
    const file = await getFile(this.cfg, INPUT_FILE_PATH);
    if (!file) throw Object.assign(new Error('Card not found'), { status: 404 });

    const cards = parseInputFile(file.content);
    const card = cards.find(c => c.id === cardId);
    if (!card) throw Object.assign(new Error('Card not found'), { status: 404 });

    const finalMarkdown = markdown ?? card.rawMarkdown;
    const destFilePath = this.cfg.basePath
      ? `${this.cfg.basePath}/${card.destPath}`
      : card.destPath;

    // Remove from input.md
    const updatedInput = removeInputCard(file.content, cardId);
    await putFile(this.cfg, INPUT_FILE_PATH, updatedInput, file.sha, `Remove card from input`);

    // Append to destination file
    try {
      const destFile = await getFile(this.cfg, destFilePath);
      if (destFile) {
        const newContent = `${destFile.content.trimEnd()}\n\n---\n\n${finalMarkdown}\n`;
        await putFile(this.cfg, destFilePath, newContent, destFile.sha, `Add card to ${destFilePath}`);
      } else {
        await putFile(this.cfg, destFilePath, `${finalMarkdown}\n`, undefined, `Create ${destFilePath}`);
      }
    } catch (err) {
      console.error(`Failed to append card to ${destFilePath}:`, err);
    }
  }

  async rejectCard(cardId: string): Promise<void> {
    const file = await getFile(this.cfg, INPUT_FILE_PATH);
    if (!file) throw Object.assign(new Error('Card not found'), { status: 404 });

    const cards = parseInputFile(file.content);
    const card = cards.find(c => c.id === cardId);
    if (!card) throw Object.assign(new Error('Card not found'), { status: 404 });

    const updatedInput = removeInputCard(file.content, cardId);
    await putFile(this.cfg, INPUT_FILE_PATH, updatedInput, file.sha, `Reject card from input`);
  }
}
