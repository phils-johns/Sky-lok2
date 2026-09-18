const LISTINGS_PATH = 'data/listings.json';

function reply(response, status, body) {
  response.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

function config() {
  const repository = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  const branch = process.env.GITHUB_BRANCH || 'main';
  if (!token || !repository || !/^[^/]+\/[^/]+$/.test(repository)) return null;
  return { repository, token, branch };
}

async function githubRequest(settings, method, path, body) {
  return fetch(`https://api.github.com/repos/${settings.repository}/contents/${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${settings.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

async function readListings(settings) {
  const response = await githubRequest(settings, 'GET', LISTINGS_PATH);
  if (response.status === 404) return { listings: [], sha: null };
  if (!response.ok) throw new Error('Lecture GitHub impossible.');
  const file = await response.json();
  const content = Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf8');
  const listings = JSON.parse(content);
  return { listings: Array.isArray(listings) ? listings : [], sha: file.sha };
}

export default async function handler(request, response) {
  const settings = config();
  if (!settings) return reply(response, 500, { error: 'Configuration GitHub manquante sur Vercel.' });
  try {
    if (request.method === 'GET') return reply(response, 200, (await readListings(settings)).listings);
    if (request.method !== 'PUT') return reply(response, 405, { error: 'Méthode non autorisée.' });

    const listings = request.body?.listings;
    if (!Array.isArray(listings)) return reply(response, 400, { error: 'Liste de logements invalide.' });
    const current = await readListings(settings);
    const body = {
      message: 'Mise à jour des logements',
      content: Buffer.from(JSON.stringify(listings, null, 2) + '\n').toString('base64'),
      branch: settings.branch,
      ...(current.sha ? { sha: current.sha } : {})
    };
    const saved = await githubRequest(settings, 'PUT', LISTINGS_PATH, body);
    if (!saved.ok) return reply(response, 409, { error: 'Le fichier a changé sur GitHub. Rechargez puis réessayez.' });
    return reply(response, 200, listings);
  } catch (error) {
    return reply(response, 502, { error: error.message || 'Erreur GitHub.' });
  }
}