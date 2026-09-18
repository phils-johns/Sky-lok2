import '@material/web/button/filled-button.js';
import '@material/web/button/filled-tonal-button.js';
import '@material/web/button/text-button.js';
import '@material/web/dialog/dialog.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/textfield/outlined-text-field.js';

const STORAGE_KEY = 'sky-location-listings';
const listingGrid = document.querySelector('#listingGrid');
const emptyState = document.querySelector('#emptyState');
const searchField = document.querySelector('#searchField');
const listingDialog = document.querySelector('#listingDialog');
const deleteDialog = document.querySelector('#deleteDialog');
const form = document.querySelector('#listingForm');
const toast = document.querySelector('#toast');
const imageInput = document.querySelector('#imageInput');
const imagePreview = document.querySelector('#imagePreview');
let listings = loadLocalListings();
let sharedStorage = false;
let editingId = null;
let deletingId = null;
let selectedImage = '';

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
    const remoteListings = await response.json();
    if (!Array.isArray(remoteListings)) throw new Error('invalid listings');
    sharedStorage = true;
    listings = remoteListings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(listings));
  } catch {
    sharedStorage = false;
  }
  render();
}

async function saveListings() {
  if (sharedStorage) {
    const response = await fetch('/api/listings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listings })
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'Impossible de sauvegarder sur GitHub.');
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(listings));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[character]);
}

function imageMarkup(item) {
  return item.image
    ? `<img src="${escapeHtml(item.image)}" alt="Photo de ${escapeHtml(item.name)}" />`
    : '<span class="material-symbols-rounded">image</span>';
}

function render() {
  const query = (searchField.value || '').trim().toLowerCase();
  const visible = listings.filter((item) => `${item.name} ${item.location} ${item.status}`.toLowerCase().includes(query));
  listingGrid.innerHTML = visible.map((item, index) => `
    <article class="listing-card" style="animation-delay:${index * 65}ms">
      <div class="image-placeholder">${imageMarkup(item)}</div>
      <div class="card-copy"><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.status)} · ${escapeHtml(item.location)}</p></div>
      <div class="card-actions">
        <button type="button" class="edit-button" data-id="${item.id}" aria-label="Modifier ${escapeHtml(item.name)}" title="Modifier"><span class="material-symbols-rounded">edit</span></button>
        <button type="button" class="delete-button" data-id="${item.id}" aria-label="Supprimer ${escapeHtml(item.name)}" title="Supprimer"><span class="material-symbols-rounded">delete</span></button>
      </div>
      <button type="button" class="card-meta contact-button" data-id="${item.id}" aria-label="Contacter pour ${escapeHtml(item.name)}">
        <span class="material-symbols-rounded">person</span><span class="card-meta-copy"><strong>Contact & réservation</strong><small>Mise en contact et informations</small></span><span class="material-symbols-rounded chevron">chevron_right</span>
      </button>
    </article>`).join('');
  emptyState.hidden = listings.length > 0;
  listingGrid.hidden = visible.length === 0;
  document.querySelector('#countPill').textContent = `${listings.length} logement${listings.length === 1 ? '' : 's'}`;
  document.querySelector('#resultsLabel').textContent = query && visible.length !== listings.length ? `${visible.length} résultat${visible.length === 1 ? '' : 's'}` : 'Mes logements';
  listingGrid.querySelectorAll('.contact-button').forEach((button) => button.addEventListener('click', () => contact(button.dataset.id)));
  listingGrid.querySelectorAll('.edit-button').forEach((button) => button.addEventListener('click', () => openEditor(button.dataset.id)));
  listingGrid.querySelectorAll('.delete-button').forEach((button) => button.addEventListener('click', () => openDelete(button.dataset.id)));
}

function contact(id) {
  const item = listings.find((entry) => entry.id === id);
  if (!item) return;
  const number = item.contact.replace(/\D/g, '');
  window.open(`https://wa.me/${number}`, '_blank', 'noopener,noreferrer');
}

function openEditor(id = null) {
  editingId = id;
  const item = id ? listings.find((entry) => entry.id === id) : null;
  document.querySelector('#dialogTitle').textContent = item ? 'Modifier le logement' : 'Ajouter un logement';
  document.querySelector('#nameInput').value = item?.name || '';
  document.querySelector('#locationInput').value = item?.location || '';
  document.querySelector('#contactInput').value = item?.contact || '22879905677';
  document.querySelector('#statusInput').value = item?.status || 'Disponible';
  selectedImage = item?.image || '';
  imageInput.value = '';
  updateImagePreview(selectedImage);
  if (typeof listingDialog.show === 'function') listingDialog.show();
  else listingDialog.open = true;
}

function closeEditor() {
  if (typeof listingDialog.close === 'function') listingDialog.close();
  else listingDialog.open = false;
  form.reset();
  selectedImage = '';
  updateImagePreview('');
  editingId = null;
}

function updateImagePreview(image) {
  imagePreview.innerHTML = image ? `<img src="${escapeHtml(image)}" alt="Aperçu de la photo" />` : '<span class="material-symbols-rounded">add_photo_alternate</span>';
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    if (!file.type.startsWith('image/')) return reject(new Error('format'));
    if (file.size > 2 * 1024 * 1024) return reject(new Error('size'));
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxDimension = 1200;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.onerror = () => reject(new Error('format'));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
}

async function uploadImage(imageData, listingName) {
  const response = await fetch('/api/upload-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageData, name: listingName })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'upload');
  return result.url;
}

async function saveListing() {
  const name = document.querySelector('#nameInput').value.trim();
  const location = document.querySelector('#locationInput').value.trim();
  const contactNumber = document.querySelector('#contactInput').value.trim();
  const status = document.querySelector('#statusInput').value;
  if (!name || !location || !/^\+?\d{8,15}$/.test(contactNumber.replace(/[\s()-]/g, ''))) {
    showToast('Vérifiez les informations saisies.');
    return;
  }
  try {
    if (imageInput.files[0]) selectedImage = await readImage(imageInput.files[0]);
  } catch (error) {
    showToast(error.message === 'size' ? 'L’image doit faire 2 Mo maximum.' : 'Choisissez une image valide.');
    return;
  }
  if (imageInput.files[0] && selectedImage.startsWith('data:')) {
    try {
      showToast('Envoi de l’image vers GitHub…');
      selectedImage = await uploadImage(selectedImage, name);
    } catch (error) {
      if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) {
        showToast(error.message === 'upload' ? 'Impossible d’enregistrer l’image sur GitHub.' : error.message);
        return;
      }
      showToast('API GitHub indisponible en local : image conservée sur cet appareil.');
    }
  }
  const normalized = contactNumber.replace(/\D/g, '');
  if (editingId) {
    const item = listings.find((entry) => entry.id === editingId);
    Object.assign(item, { name, location, contact: normalized, status, image: selectedImage });
    showToast('Logement modifié.');
  } else {
    listings.unshift({ id: crypto.randomUUID(), name, location, contact: normalized, status, image: selectedImage });
    showToast('Logement ajouté.');
  }
  try {
    await saveListings();
  } catch (error) {
    showToast(error.message);
    return;
  }
  closeEditor();
  render();
}

function openDelete(id) {
  deletingId = id;
  if (typeof deleteDialog.show === 'function') deleteDialog.show();
  else deleteDialog.open = true;
}
async function deleteListing() {
  listings = listings.filter((item) => item.id !== deletingId);
  try {
    await saveListings();
  } catch (error) {
    showToast(error.message);
    return;
  }
  if (typeof deleteDialog.close === 'function') deleteDialog.close();
  else deleteDialog.open = false;
  deletingId = null;
  render();
  showToast('Logement supprimé.');
}

let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

document.querySelector('#addButton').addEventListener('click', () => openEditor());
document.querySelector('#emptyAddButton').addEventListener('click', () => openEditor());
document.querySelector('#cancelButton').addEventListener('click', closeEditor);
document.querySelector('#saveButton').addEventListener('click', saveListing);
document.querySelector('#deleteCancel').addEventListener('click', () => {
  if (typeof deleteDialog.close === 'function') deleteDialog.close();
  else deleteDialog.open = false;
});
document.querySelector('#deleteConfirm').addEventListener('click', deleteListing);
searchField.addEventListener('input', render);
imageInput.addEventListener('change', async () => {
  try {
    selectedImage = await readImage(imageInput.files[0]);
    updateImagePreview(selectedImage);
  } catch (error) {
    imageInput.value = '';
    selectedImage = '';
    updateImagePreview('');
    showToast(error.message === 'size' ? 'L’image doit faire 2 Mo maximum.' : 'Choisissez une image valide.');
  }
});
document.querySelector('#themeButton').addEventListener('click', () => {
  const isDark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = isDark ? 'light' : 'dark';
  document.querySelector('#themeButton span').textContent = isDark ? 'dark_mode' : 'light_mode';
});

render();
loadListings();
