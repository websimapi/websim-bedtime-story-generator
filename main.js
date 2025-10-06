/* ...existing code... */
/* new file - main runtime logic for the small app */

const apiState = {
  key: null, // kept only in-memory for session
};

const el = {
  seed: document.getElementById('seed'),
  generate: document.getElementById('generate'),
  clear: document.getElementById('clear'),
  story: document.getElementById('story'),
  keyModal: document.getElementById('keyModal'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  saveKey: document.getElementById('saveKey'),
  cancelKey: document.getElementById('cancelKey'),
};

function showModal() {
  el.apiKeyInput.value = '';
  el.keyModal.classList.remove('hidden');
  el.apiKeyInput.focus();
}

function hideModal() {
  el.keyModal.classList.add('hidden');
}

function promptForKeyIfNeeded() {
  if (!apiState.key) {
    return new Promise((resolve) => {
      showModal();
      const onSave = () => {
        const val = el.apiKeyInput.value.trim();
        if (!val) return;
        apiState.key = val;
        hideModal();
        cleanup();
        resolve(val);
      };
      const onCancel = () => {
        hideModal();
        cleanup();
        resolve(null);
      };
      const cleanup = () => {
        el.saveKey.removeEventListener('click', onSave);
        el.cancelKey.removeEventListener('click', onCancel);
      };
      el.saveKey.addEventListener('click', onSave);
      el.cancelKey.addEventListener('click', onCancel);
    });
  }
  return Promise.resolve(apiState.key);
}

function setLoading(isLoading) {
  el.generate.disabled = isLoading;
  el.generate.textContent = isLoading ? 'Generating…' : 'Generate Story';
}

function parseResponseOutput(json) {
  // Try multiple possible locations for text output
  if (json.output_text) return json.output_text;
  if (Array.isArray(json.output) && json.output.length) {
    // Response SDK style
    try {
      const out = json.output.map(item => {
        if (typeof item === 'string') return item;
        if (item.content) {
          return item.content.map(c => c.text ?? c?.content ?? '').join('');
        }
        return '';
      }).join('\n');
      if (out.trim()) return out;
    } catch(e){}
  }
  // fallback for responses v1
  if (json.output?.length && json.output[0].content?.length) {
    return json.output[0].content.map(c => c.text ?? c?.content ?? '').join('');
  }
  return JSON.stringify(json, null, 2);
}

async function callOpenAI(apiKey, promptSeed) {
  const endpoint = 'https://api.openai.com/v1/responses';
  const systemPrompt = "You are a kind storyteller who writes short calming bedtime stories suitable for children. Keep it gentle and under 300 words.";
  const userPrompt = `Write a short bedtime story about a unicorn.${promptSeed ? " Seed: " + promptSeed : ""}`;

  const body = {
    model: "gpt-5",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    max_tokens: 600,
    temperature: 0.8,
    // stop is optional
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${text}`);
  }
  const json = await res.json();
  return parseResponseOutput(json);
}

el.generate.addEventListener('click', async () => {
  setLoading(true);
  el.story.textContent = '';
  try {
    const key = await promptForKeyIfNeeded();
    if (!key) {
      el.story.textContent = 'API key required to generate story.';
      setLoading(false);
      return;
    }
    const seed = el.seed.value.trim();
    const story = await callOpenAI(key, seed);
    el.story.textContent = story;
  } catch (err) {
    console.error(err);
    el.story.textContent = 'Error: ' + (err.message || String(err));
  } finally {
    setLoading(false);
  }
});

el.clear.addEventListener('click', () => {
  el.seed.value = '';
  el.story.textContent = 'No story yet — click "Generate Story".';
});

/* ...existing code... */

