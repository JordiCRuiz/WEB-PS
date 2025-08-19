// Chatbot frontend — Vercel backend + File Search
const USE_BACKEND = true;
const API_PATH = '/api/chat';

const $ = (s) => document.querySelector(s);
const elToggle = $('#chatbotToggle');
const elPanel = $('#chatbotPanel');
const elClose = $('#chatbotClose');
const elForm = $('#chatbotForm');
const elInput = $('#chatbotInput');
const elMsgs = $('#chatbotMessages');
const elSend = $('#chatbotSend');

function openPanel() {
  elPanel.hidden = false;
  elToggle.setAttribute('aria-expanded', 'true');
  elInput?.focus();
}
function closePanel() {
  elPanel.hidden = true;
  elToggle.setAttribute('aria-expanded', 'false');
  elToggle?.focus();
}
elToggle?.addEventListener('click', () =>
  elPanel.hidden ? openPanel() : closePanel()
);
elClose?.addEventListener('click', closePanel);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !elPanel.hidden) closePanel();
});

function addMsg(text, who = 'bot') {
  const div = document.createElement('div');
  div.className = `${who} msg`;
  div.textContent = text;
  elMsgs?.appendChild(div);
  elMsgs.scrollTop = elMsgs.scrollHeight;
}

function oneParagraph(text) {
  let t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > 900) t = t.slice(0, 900) + '…';
  return t;
}

async function askBackend(q) {
  const res = await fetch(API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: q }),
  });
  if (!res.ok) throw new Error('Network error');
  const data = await res.json();
  return data.answer || 'I could not generate a reply right now.';
}

elForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = elInput.value.trim();
  if (q.length < 5) {
    elInput.focus();
    return;
  }
  addMsg(q, 'user');
  elInput.value = '';
  elInput.setAttribute('aria-busy', 'true');
  elSend.disabled = true;
  try {
    const raw = USE_BACKEND
      ? await askBackend(q)
      : 'Please enable the backend.';
    addMsg(oneParagraph(raw), 'bot');
  } catch {
    addMsg('Sorry, something went wrong. Please try again in a moment.', 'bot');
  } finally {
    elInput.removeAttribute('aria-busy');
    elSend.disabled = false;
    elInput.focus();
  }
});
