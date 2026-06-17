// ── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'recipe_manager_v1';

function loadRecipes() {
  try {
    const d = localStorage.getItem(STORAGE_KEY);
    return d ? JSON.parse(d) : [];
  } catch { return []; }
}

function saveRecipes(r) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
}

// ── State ─────────────────────────────────────────────────────────────────────

let recipes = loadRecipes();
let view = 'browse';      // browse | add | detail | cook
let detailId = null;
let cookingSteps = [];
let servingsMultiplier = 1;
let filterTag = 'all';
let searchQ = '';
let ingFilter = '';
let uploadedImageData = null;

// ── Sample data (shown when collection is empty) ──────────────────────────────

const SAMPLE = [
  {
    id: 's1',
    name: 'Classic Pasta Carbonara',
    servings: 2,
    time: 25,
    tags: ['pasta', 'quick'],
    ingredients: [
      { name: 'spaghetti', amount: 200, unit: 'g', original: null },
      { name: 'pancetta', amount: 100, unit: 'g', original: null },
      { name: 'eggs', amount: 2, unit: '', original: null },
      { name: 'parmesan', amount: 50, unit: 'g', original: null },
      { name: 'black pepper', amount: 1, unit: 'tsp', original: null }
    ],
    steps: [
      'Boil salted water and cook spaghetti until al dente.',
      'Fry pancetta in a pan until crispy. Remove from heat.',
      'Whisk eggs with half the parmesan and pepper.',
      'Drain pasta, reserving 1 cup water.',
      'Toss hot pasta into the pancetta pan off heat.',
      'Add egg mixture, tossing quickly and adding pasta water to loosen.',
      'Serve with remaining parmesan.'
    ],
    hasConversions: false
  },
  {
    id: 's2',
    name: 'Lemon Garlic Salmon',
    servings: 4,
    time: 20,
    tags: ['fish', 'healthy'],
    ingredients: [
      { name: 'salmon fillets', amount: 4, unit: '', original: null },
      { name: 'garlic cloves', amount: 3, unit: '', original: null },
      { name: 'lemon', amount: 1, unit: '', original: null },
      { name: 'olive oil', amount: 2, unit: 'tbsp', original: null },
      { name: 'fresh dill', amount: 1, unit: 'tbsp', original: null }
    ],
    steps: [
      'Preheat oven to 200°C.',
      'Mix oil, minced garlic, lemon zest and juice.',
      'Place salmon on a baking tray and pour over the mixture.',
      'Bake for 12–15 minutes until cooked through.',
      'Garnish with dill and serve immediately.'
    ],
    hasConversions: false
  }
];

// ── Unit conversion ───────────────────────────────────────────────────────────

function closestVolumeUnit(ml) {
  if (ml < 5)   return { amount: parseFloat((ml / 5).toFixed(2)), unit: 'tsp' };
  if (ml < 20)  return { amount: parseFloat((ml / 5).toFixed(1)), unit: 'tsp' };
  if (ml < 60)  return { amount: parseFloat((ml / 15).toFixed(1)), unit: 'tbsp' };
  if (ml < 900) return { amount: parseFloat((ml / 100).toFixed(1)), unit: 'dl' };
  return { amount: parseFloat((ml / 1000).toFixed(2)), unit: 'l' };
}

function convertIngredient(ing) {
  const u = (ing.unit || '').toLowerCase().trim();
  const a = ing.amount;

  // Weight: imperial → g
  if (u === 'oz' || u === 'ounce' || u === 'ounces') {
    return { ...ing, amount: Math.round(a * 28.35), unit: 'g', original: `${a} ${ing.unit}` };
  }
  if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') {
    return { ...ing, amount: Math.round(a * 453.59), unit: 'g', original: `${a} ${ing.unit}` };
  }

  // Volume: imperial → ml → closest metric label
  let ml = null;
  if (u === 'cup' || u === 'cups')                                                          ml = a * 240;
  if (u === 'fl oz' || u === 'fl.oz' || u === 'fluid oz' || u === 'fluid ounce' || u === 'fluid ounces') ml = a * 29.57;
  if (u === 'pint' || u === 'pints' || u === 'pt')                                         ml = a * 473;
  if (u === 'quart' || u === 'quarts' || u === 'qt')                                       ml = a * 946;
  if (u === 'gallon' || u === 'gallons' || u === 'gal')                                    ml = a * 3785;

  if (ml !== null) {
    const { amount: ca, unit: cu } = closestVolumeUnit(ml);
    return { ...ing, amount: ca, unit: cu, original: `${a} ${ing.unit}` };
  }

  return { ...ing, original: null };
}

function convertRecipeUnits(recipe) {
  const ingredients = recipe.ingredients.map(convertIngredient);
  const hasConversions = ingredients.some(i => i.original);
  return { ...recipe, ingredients, hasConversions };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRecipes() {
  return recipes.length === 0 ? SAMPLE : recipes;
}

function allTags() {
  const t = new Set();
  getRecipes().forEach(r => r.tags.forEach(x => t.add(x)));
  return Array.from(t);
}

function filteredRecipes() {
  let r = getRecipes();
  if (filterTag !== 'all') r = r.filter(x => x.tags.includes(filterTag));
  if (searchQ) r = r.filter(x =>
    x.name.toLowerCase().includes(searchQ.toLowerCase()) ||
    x.ingredients.some(i => i.name.toLowerCase().includes(searchQ.toLowerCase()))
  );
  if (ingFilter) {
    const ings = ingFilter.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    if (ings.length > 0) {
      r = r.filter(x => ings.every(i => x.ingredients.some(ing => ing.name.toLowerCase().includes(i))));
    }
  }
  return r;
}

function fmtAmount(amount, mult) {
  const v = amount * mult;
  return v % 1 === 0 ? v : parseFloat(v.toFixed(1));
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  const app = document.getElementById('app');
  if (view === 'browse') app.innerHTML = renderBrowse();
  else if (view === 'add') app.innerHTML = renderAdd();
  else if (view === 'detail') app.innerHTML = renderDetail();
  else if (view === 'cook') app.innerHTML = renderCook();
  attachEvents();
}

function renderBrowse() {
  const tags = allTags();
  const list = filteredRecipes();
  return `
    <div class="topbar">
      <h1><i class="ti ti-chef-hat" aria-hidden="true" style="margin-right:8px"></i>Recipes</h1>
      <div style="display:flex;gap:8px">
        <button class="view-btn active" data-v="browse"><i class="ti ti-layout-grid"></i></button>
        <button class="view-btn" data-v="add"><i class="ti ti-plus"></i> Add</button>
      </div>
    </div>
    <div class="search-row">
      <input type="text" placeholder="Search recipes or ingredients…" id="sq" value="${searchQ}">
    </div>
    <span class="ing-label">Filter by ingredients I have (comma-separated)</span>
    <input type="text" placeholder="e.g. eggs, garlic, lemon" id="iq" value="${ingFilter}">
    <div class="filter-row">
      <button class="tag-btn${filterTag === 'all' ? ' active' : ''}" data-tag="all">All</button>
      ${tags.map(t => `<button class="tag-btn${filterTag === t ? ' active' : ''}" data-tag="${t}">${t}</button>`).join('')}
    </div>
    ${list.length === 0
      ? `<div class="empty"><i class="ti ti-inbox" aria-hidden="true"></i>No recipes match — try different filters or add one.</div>`
      : `<div class="grid">${list.map(r => `
          <div class="recipe-card" data-id="${r.id}">
            <h3>${r.name}</h3>
            <div class="meta"><i class="ti ti-clock" aria-hidden="true"></i> ${r.time} min &nbsp;<i class="ti ti-users" aria-hidden="true"></i> ${r.servings}</div>
            <div class="tags">${r.tags.map(t => `<span class="pill">${t}</span>`).join('')}</div>
          </div>`).join('')}
        </div>`
    }`;
}

function renderAdd() {
  return `
    <div class="topbar">
      <button class="view-btn" data-v="browse"><i class="ti ti-arrow-left"></i> Back</button>
      <h1>Add recipe</h1>
    </div>
    <div class="panel">
      <h2>Import with AI</h2>
      <label>Paste recipe text</label>
      <textarea id="paste-input" placeholder="Paste any recipe — from a website, a book, or just a description…"></textarea>
      <label>Or upload a photo / image of a recipe</label>
      <div class="upload-area" id="upload-area">
        <i class="ti ti-camera" aria-hidden="true"></i>
        Click to upload an image
      </div>
      <input type="file" id="file-input" accept="image/*">
      <div id="img-preview" style="margin-top:8px"></div>
      <div class="btn-row">
        <button class="btn-primary" id="parse-btn">
          <i class="ti ti-wand" aria-hidden="true"></i> Parse with AI
        </button>
      </div>
      <div class="status" id="parse-status"></div>
    </div>`;
}

function renderDetail() {
  const r = getRecipes().find(x => x.id === detailId);
  if (!r) return renderBrowse();
  const mult = servingsMultiplier;
  const isUser = recipes.find(x => x.id === detailId);
  return `
    <div class="topbar">
      <button class="view-btn" data-v="browse"><i class="ti ti-arrow-left"></i> Back</button>
      <h1>${r.name}</h1>
      ${isUser ? `<button class="btn-danger" id="delete-btn" aria-label="Delete recipe"><i class="ti ti-trash" aria-hidden="true"></i></button>` : ''}
    </div>
    <div class="detail">
      <div class="detail-meta">
        <span><i class="ti ti-clock" aria-hidden="true"></i>${r.time} min</span>
        ${r.tags.map(t => `<span class="pill">${t}</span>`).join('')}
      </div>
      ${r.hasConversions ? `
        <div class="conversion-notice">
          <i class="ti ti-refresh" aria-hidden="true"></i>
          Some units have been converted from imperial to metric. Original values shown in brackets.
        </div>` : ''}
      <div class="servings-ctrl">
        <span>Servings</span>
        <button class="sctl-btn" id="serv-down" aria-label="Fewer servings">−</button>
        <span class="count" id="serv-count">${Math.round(r.servings * mult)}</span>
        <button class="sctl-btn" id="serv-up" aria-label="More servings">+</button>
        <button class="btn-primary" id="cook-btn" style="margin-left:auto">Start cooking</button>
      </div>
      <div>
        <h3 style="font-size:16px;font-weight:500;margin-bottom:12px">Ingredients</h3>
        <div class="ingredients-list">
          ${r.ingredients.map(i => `
            <div class="ing-row">
              <span class="ing-amount">${fmtAmount(i.amount, mult)} ${i.unit}${i.original ? `<span class="original-unit">(${i.original})</span>` : ''}</span>
              <span>${i.name}</span>
            </div>`).join('')}
        </div>
      </div>
      <div>
        <h3 style="font-size:16px;font-weight:500;margin-bottom:12px">Method</h3>
        <div class="steps-list">
          ${r.steps.map((s, i) => `
            <div class="step-row">
              <div class="step-num">${i + 1}</div>
              <div class="step-text">${s}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

function renderCook() {
  const r = getRecipes().find(x => x.id === detailId);
  if (!r) return renderBrowse();
  return `
    <div class="topbar">
      <button class="view-btn" data-v="detail"><i class="ti ti-arrow-left"></i> Recipe</button>
      <h1 style="font-size:16px">Cooking: ${r.name}</h1>
    </div>
    <div class="cooking-mode">
      ${r.steps.map((s, i) => `
        <div class="step-row cooking-step${cookingSteps.includes(i) ? ' done' : ''}" data-step="${i}">
          <div class="step-num">
            ${cookingSteps.includes(i) ? '<i class="ti ti-check" aria-hidden="true"></i>' : i + 1}
          </div>
          <div class="step-text">${s}</div>
        </div>`).join('')}
    </div>
    <p class="hint">Tap a step to mark it done</p>`;
}

// ── Events ────────────────────────────────────────────────────────────────────

function attachEvents() {
  // Navigation
  document.querySelectorAll('[data-v]').forEach(b => {
    b.addEventListener('click', () => {
      view = b.dataset.v;
      if (view === 'browse') { servingsMultiplier = 1; ingFilter = ''; }
      render();
    });
  });

  // Tag filters
  document.querySelectorAll('[data-tag]').forEach(b => {
    b.addEventListener('click', () => { filterTag = b.dataset.tag; render(); });
  });

  // Recipe card click
  document.querySelectorAll('[data-id]').forEach(b => {
    b.addEventListener('click', () => {
      detailId = b.dataset.id;
      servingsMultiplier = 1;
      view = 'detail';
      render();
    });
  });

  // Search
  const sq = document.getElementById('sq');
  if (sq) sq.addEventListener('input', e => { searchQ = e.target.value; render(); });

  // Ingredient filter
  const iq = document.getElementById('iq');
  if (iq) iq.addEventListener('input', e => { ingFilter = e.target.value; render(); });

  // Servings
  const r = getRecipes().find(x => x.id === detailId);
  const sd = document.getElementById('serv-down');
  if (sd && r) sd.addEventListener('click', () => {
    const cur = Math.round(r.servings * servingsMultiplier);
    if (cur > 1) servingsMultiplier = (cur - 1) / r.servings;
    render();
  });
  const su = document.getElementById('serv-up');
  if (su && r) su.addEventListener('click', () => {
    const cur = Math.round(r.servings * servingsMultiplier);
    servingsMultiplier = (cur + 1) / r.servings;
    render();
  });

  // Start cooking
  const cb = document.getElementById('cook-btn');
  if (cb) cb.addEventListener('click', () => { cookingSteps = []; view = 'cook'; render(); });

  // Cooking step toggle
  document.querySelectorAll('.cooking-step').forEach(el => {
    el.addEventListener('click', () => {
      const i = parseInt(el.dataset.step);
      if (cookingSteps.includes(i)) cookingSteps = cookingSteps.filter(x => x !== i);
      else cookingSteps.push(i);
      render();
    });
  });

  // Delete recipe
  const db = document.getElementById('delete-btn');
  if (db) db.addEventListener('click', () => {
    if (confirm('Delete this recipe?')) {
      recipes = recipes.filter(x => x.id !== detailId);
      saveRecipes(recipes);
      view = 'browse';
      render();
    }
  });

  // Image upload
  const ua = document.getElementById('upload-area');
  const fi = document.getElementById('file-input');
  if (ua && fi) {
    ua.addEventListener('click', () => fi.click());
    fi.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        uploadedImageData = ev.target.result.split(',')[1];
        const prev = document.getElementById('img-preview');
        if (prev) prev.innerHTML = `<img src="${ev.target.result}" style="max-width:100%;max-height:180px;border-radius:8px;border:0.5px solid rgba(0,0,0,0.12)">`;
        const ua2 = document.getElementById('upload-area');
        if (ua2) ua2.innerHTML = `<i class="ti ti-check" aria-hidden="true"></i> ${file.name}`;
      };
      reader.readAsDataURL(file);
    });
  }

  // Parse button
  const pb = document.getElementById('parse-btn');
  if (pb) pb.addEventListener('click', parseRecipe);
}

// ── AI Parsing ────────────────────────────────────────────────────────────────

async function parseRecipe() {
  const text = document.getElementById('paste-input')?.value || '';
  const status = document.getElementById('parse-status');
  const btn = document.getElementById('parse-btn');

  if (!text && !uploadedImageData) {
    status.textContent = 'Please paste text or upload an image first.';
    return;
  }

  btn.disabled = true;
  status.textContent = 'Parsing with AI…';

  const userContent = [];
  if (uploadedImageData) {
    userContent.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: uploadedImageData } });
  }
  if (text) {
    userContent.push({ type: 'text', text });
  }
  userContent.push({
    type: 'text',
    text: `Extract the recipe and return ONLY a JSON object (no markdown, no backticks) with this exact shape:
{"name":"string","servings":number,"time":number,"tags":["string"],"ingredients":[{"name":"string","amount":number,"unit":"string"}],"steps":["string"]}
- time is total minutes (estimate if not given)
- tags: 2-4 short lowercase tags like pasta, quick, vegetarian, healthy, fish, soup
- unit can be g, kg, ml, l, tbsp, tsp, dl, cup, oz, lb, fl oz, or empty string for countable items — preserve the original unit from the source exactly, do not convert units yourself
- steps are plain strings without step numbers`
  });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: userContent }]
      })
    });
    const data = await res.json();
    const raw = data.content.map(c => c.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // Convert imperial units to metric
    const converted = convertRecipeUnits(parsed);
    converted.id = 'r' + Date.now();

    recipes.push(converted);
    saveRecipes(recipes);
    detailId = converted.id;
    servingsMultiplier = 1;
    uploadedImageData = null;
    view = 'detail';
    render();
  } catch (e) {
    status.textContent = 'Could not parse recipe. Try pasting more text, or a clearer image.';
    btn.disabled = false;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

render();