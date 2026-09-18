import { randomUUID } from 'node:crypto';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

function json(response, status, body) {
  response.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return json(response, 405, { error: 'Méthode non autorisée.' });

  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  if (!token || !repository) return json(response, 500, { error: 'Configuration GitHub manquante sur Vercel.' });
  if (!/^[^/]+\/[^/]+$/.test(repository)) return json(response, 500, { error: 'GITHUB_REPO doit respecter le format propriétaire/depot.' });

  const { image, name } = request.body || {};
  const match = typeof image === 'string' && image.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
  if (!match) return json(response, 400, { error: 'Image invalide.' });

  const [, mime, encodedImage] = match;
  const imageBuffer = Buffer.from(encodedImage, 'base64');
  if (imageBuffer.length > MAX_IMAGE_BYTES) return json(response, 413, { error: 'Image trop volumineuse.' });

  const safeName = String(name || 'logement').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'logement';
  const extension = MIME_EXTENSIONS[mime];
  const path = `public/uploads/logements/${safeName}-${randomUUID()}.${extension}`;
  const githubResponse = await fetch(`https://api.github.com/repos/${repository}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message: `Ajout de l’image du logement ${safeName}`, content: imageBuffer.toString('base64'), branch })
  });
  if (!githubResponse.ok) return json(response, 502, { error: 'GitHub n’a pas accepté l’image.' });

  return json(response, 200, {
    path,
    url: `https://raw.githubusercontent.com/${repository}/${branch}/${path}`
  });
}