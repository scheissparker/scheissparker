// Falls das Frontend separat gehostet wird (z. B. auf scheissparker.github.io),
// trage hier die HTTPS-Adresse deines Ubuntu-Servers oder Cloudflare-Tunnels ein:
// Beispiel: const BACKEND_URL = 'https://api.deinedomain.de';
const BACKEND_URL = '';

// Automatische Ermittlung:
const API_BASE_URL = BACKEND_URL
  ? BACKEND_URL.replace(/\/+$/, '')
  : (window.location.origin.startsWith('http') && !window.location.port.includes('5500') && !window.location.hostname.includes('github.io')
      ? '' 
      : 'http://localhost:31200');

const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const submitBtn = document.getElementById('submitBtn');
const submitBtnText = document.getElementById('submitBtnText');
const preview = document.getElementById('preview');
const previewImage = document.getElementById('previewImage');
const previewPlaceholder = document.getElementById('previewPlaceholder');
const instaHandle = document.getElementById('instaHandle');
const statusBox = document.getElementById('statusBox');
const statusTitle = document.getElementById('statusTitle');
const statusDesc = document.getElementById('statusDesc');
const resetBtn = document.getElementById('resetBtn');

let selectedFile = null;

function showStatus(type, title, desc) {
  statusBox.className = `status-box ${type}`;
  statusTitle.textContent = title;
  statusDesc.textContent = desc;
  statusBox.style.display = type === 'loading' ? 'flex' : 'block';
}

function hideStatus() {
  statusBox.style.display = 'none';
  statusBox.className = 'status-box';
}

function resetForm() {
  selectedFile = null;
  fileInput.value = '';
  previewImage.src = '';
  previewImage.hidden = true;
  previewPlaceholder.hidden = false;
  preview.classList.remove('has-image');
  submitBtn.disabled = true;
  submitBtn.classList.remove('is-loading');
  submitBtnText.textContent = 'Melden';
  uploadBtn.disabled = false;
  instaHandle.disabled = false;
  resetBtn.hidden = true;
  hideStatus();
}

uploadBtn.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;

  // Max 15 MB client-side check
  const maxBytes = 15 * 1024 * 1024;
  if (file.size > maxBytes) {
    showStatus('error', 'Datei zu gross', 'Das Bild darf maximal 15 MB gross sein.');
    fileInput.value = '';
    return;
  }

  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImage.src = e.target.result;
    previewImage.hidden = false;
    previewPlaceholder.hidden = true;
    preview.classList.add('has-image');
    submitBtn.disabled = false;
    hideStatus();
    resetBtn.hidden = true;
  };
  reader.readAsDataURL(file);
});

submitBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  const handle = instaHandle.value.trim();

  // Validate Instagram Handle syntax if provided
  if (handle) {
    const rawUser = handle.startsWith('@') ? handle.slice(1) : handle;
    const valid = /^[a-zA-Z0-9._]{1,30}$/.test(rawUser);
    if (!valid) {
      showStatus('error', 'Ungueltiger Instagram-Name', 'Erlaubt sind 1-30 Zeichen (Buchstaben, Zahlen, Punkte, Unterstriche).');
      return;
    }
  }

  // Set loading UI state: show spinner only during active analysis
  submitBtn.disabled = true;
  submitBtn.classList.add('is-loading');
  uploadBtn.disabled = true;
  instaHandle.disabled = true;
  submitBtnText.textContent = 'Analysiere...';

  showStatus(
    'loading',
    'KI analysiert Bild...',
    'OpenRouter prueft, ob es sich um ein Kraftfahrzeug oder eine Parksituation handelt...'
  );

  const formData = new FormData();
  formData.append('file', selectedFile);
  if (handle) {
    formData.append('instaHandle', handle);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Success
      const reason = data.analysis?.reason || 'Fahrzeug erfolgreich verifiziert.';
      const handleNote = data.instagram_handle ? ` (Instagram: ${data.instagram_handle})` : '';
      const channelInfo = data.discord_channels_count > 1 ? ` in ${data.discord_channels_count} Kanaelen` : '';
      showStatus(
        'success',
        'Falschparker verifiziert und auf Discord gepostet',
        `${reason} Erfolgreich per Bot${channelInfo} geteilt.${handleNote}`
      );
      resetBtn.hidden = false;
    } else if (response.status === 409) {
      // Duplicate photo
      const errorMsg = data.detail || 'Dieses Foto wurde bereits gemeldet. Duplikate sind nicht erlaubt.';
      showStatus('error', 'Bereits gemeldet', errorMsg);
      submitBtn.disabled = false;
      uploadBtn.disabled = false;
      instaHandle.disabled = false;
    } else if (response.status === 422) {
      // AI determined image is not a car
      const reason = data.analysis?.reason || data.message || 'Kein Kraftfahrzeug auf dem Bild erkennbar.';
      showStatus(
        'error',
        'Kein Falschparker erkannt',
        `Die KI meldet: "${reason}". Bitte lade nur Fotos von Fahrzeugen bzw. Falschparkern hoch.`
      );
      submitBtn.disabled = false;
      uploadBtn.disabled = false;
      instaHandle.disabled = false;
    } else {
      // Other backend error
      const errorMsg = data.detail || data.message || `Serverfehler (${response.status})`;
      showStatus('error', 'Fehler beim Upload', errorMsg);
      submitBtn.disabled = false;
      uploadBtn.disabled = false;
      instaHandle.disabled = false;
    }
  } catch (err) {
    showStatus(
      'error',
      'Verbindungsfehler',
      `Backend nicht erreichbar (${API_BASE_URL}). Stelle sicher, dass der Server laeuft.`
    );
    submitBtn.disabled = false;
    uploadBtn.disabled = false;
    instaHandle.disabled = false;
  } finally {
    submitBtn.classList.remove('is-loading');
    submitBtnText.textContent = 'Melden';
  }
});

resetBtn.addEventListener('click', resetForm);
