import '@material/web/textfield/outlined-text-field.js';

const STORAGE_KEY = 'sky-location-listings';
const listingGrid = document.querySelector('#listingGrid');
const emptyState = document.querySelector('#emptyState');
const searchField = document.querySelector('#searchField');

function loadLocalListings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

async function loadListings() {
  try {
    const response = await fetch('/api/listings', { cache: 'no-store' });
    if (!response.ok) throw new Error('shared storage unavailable');
    const listings = await response.json();
    return Array.isArray(listings) ? listings : [];
  } catch {
    return loadLocalListings();
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[character]);
}

function imageMarkup(item) {
  return item.image
    ? `<img src="${escapeHtml(item.image)}" alt="Photo de ${escapeHtml(item.name)}" />`
    : '<span class="material-symbols-rounded">image</span>';
}

function contact(item) {
  const number = item.contact.replace(/\D/g, '');
  window.open(`https://wa.me/${number}`, '_blank', 'noopener,noreferrer');
}

async function render() {
  const listings = await loadListings();
  const query = (searchField.value || '').trim().toLowerCase();
  const visible = listings.filter((item) => `${item.name} ${item.location} ${item.status}`.toLowerCase().includes(query));
  listingGrid.innerHTML = visible.map((item, index) => `
    <article class="listing-card read-only-card" style="animation-delay:${index * 65}ms">
      <div class="image-placeholder">${imageMarkup(item)}</div>
      <div class="card-copy"><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.status)} · ${escapeHtml(item.location)}</p></div>
      <button type="button" class="card-meta contact-button" data-id="${item.id}" aria-label="Contacter pour ${escapeHtml(item.name)}">
        <span class="material-symbols-rounded">person</span><span class="card-meta-copy"><strong>Contact & réservation</strong><small>Mise en contact et informations</small></span><span class="material-symbols-rounded chevron">chevron_right</span>
      </button>
    </article>`).join('');
  emptyState.hidden = listings.length > 0;
  listingGrid.hidden = visible.length === 0;
  document.querySelector('#countPill').textContent = `${listings.length} logement${listings.length === 1 ? '' : 's'}`;
  document.querySelector('#resultsLabel').textContent = query && visible.length !== listings.length ? `${visible.length} résultat${visible.length === 1 ? '' : 's'}` : 'Logements disponibles';
  listingGrid.querySelectorAll('.contact-button').forEach((button) => button.addEventListener('click', () => {
    const item = listings.find((entry) => entry.id === button.dataset.id);
    if (item) contact(item);
  }));
}

searchField.addEventListener('input', render);
document.querySelector('#themeButton').addEventListener('click', () => {
  const isDark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = isDark ? 'light' : 'dark';
  document.querySelector('#themeButton span').textContent = isDark ? 'dark_mode' : 'light_mode';
});

window.addEventListener('storage', render);
render();