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
let uploadedImages = [];

// ── Language ───────────────────────────────────────────────────────────────────

const langsList = 
{
  english: {
    Add: 'Add',
    All: 'All',
    Back: 'Back',

    Browse_head: 'Recipes',
    Browse_search_1: 'Search recipes or ingredients…',
    Browse_search_span: 'Filter by ingredients I have (comma-separated)',
    Browse_search_2: 'e.g. eggs, garlic, lemon',
    Browse_tags: ['Savory', 'Sweet'],
    Browse_noresult: 'No recipes match — try different filters or add one.',

    Details_Ingredients: 'Ingredients',
    Details_Instructions: 'Instructions',
    Deatails_UnitsConverted: 'Some units have been converted from imperial to metric. Original values shown in brackets.',
    Details_Servings: 'Servings',

    Savory: 'Savory',
    Sweet: 'Sweet'

      
  },

  finnish: {
    Add: 'Lisää',
    All: 'Kaikki',
    Back: 'Takaisin',

    Browse_head: 'Reseptit',
    Browse_search_1: 'Etsi reseptejä tai ainesosia…',
    Browse_search_span: 'Suodata ainesosien perusteella (erotetaan pilkulla)',
    Browse_search_2: 'esim. muna, valkosipuli, sitruuna',
    Browse_tags: ['Suolainen', 'Makea'],
    Browse_noresult: 'Ei tuloksia — yritä eri suodattimia.',

    Details_Ingredients: 'Ainesosat',
    Details_Instructions: 'Valmistusohjeet',
    Details_UnitsConverted: 'Joitain arvoja on muunnettu metrijärjestelmään. Alkuperäiset suluissa.',
    Details_Servings: 'Annokset',

    Savory: 'Suolainen',
    Sweet: 'Makea'
  }
}

let currentLang = localStorage.getItem('language') ?? 'english';
let language = langsList[currentLang];

function changeLanguage() {
  currentLang = currentLang === 'english' ? 'finnish' : 'english';
  language = langsList[currentLang];
  localStorage.setItem('language', currentLang);
  render();
}

// ── Sample data (shown when collection is empty) ──────────────────────────────

const SAMPLE = [
  {
    id: 's1',
    name: 'Classic Pasta Carbonara',
    servings: 2,
    time: 25,
    tags: ['Savory'],
    ingredients: {
      none: [
        { name: 'spaghetti',     amounts: [{ amount: 200, unit: 'g'   }] },
        { name: 'pancetta',      amounts: [{ amount: 100, unit: 'g'   }] },
        { name: 'eggs',          amounts: [{ amount: 2,   unit: ''    }] },
        { name: 'parmesan',      amounts: [{ amount: 50,  unit: 'g'   }] },
        { name: 'black pepper',  amounts: [{ amount: 1,   unit: 'tsp' }] }
      ]
    },
    steps: {
      none: [
        'Boil salted water and cook spaghetti until al dente.',
        'Fry pancetta in a pan until crispy. Remove from heat.',
        'Whisk eggs with half the parmesan and pepper.',
        'Drain pasta, reserving 1 cup water.',
        'Toss hot pasta into the pancetta pan off heat.',
        'Add egg mixture, tossing quickly and adding pasta water to loosen.',
        'Serve with remaining parmesan.'
      ]
    },
    hasConversions: false
  },
  {
    id: 's2',
    name: 'Lemon Garlic Salmon',
    servings: 4,
    time: 20,
    tags: ['Savory'],
    ingredients: {
      none: [
        { name: 'salmon fillets', amounts: [{ amount: 4, unit: ''     }] },
        { name: 'garlic cloves',  amounts: [{ amount: 3, unit: ''     }] },
        { name: 'lemon',          amounts: [{ amount: 1, unit: ''     }] },
        { name: 'olive oil',      amounts: [{ amount: 2, unit: 'tbsp' }] },
        { name: 'fresh dill',     amounts: [{ amount: 1, unit: 'tbsp' }] }
      ]
    },
    steps: {
      none: [
        'Preheat oven to 200°C.',
        'Mix oil, minced garlic, lemon zest and juice.',
        'Place salmon on a baking tray and pour over the mixture.',
        'Bake for 12–15 minutes until cooked through.',
        'Garnish with dill and serve immediately.'
      ]
    },
    hasConversions: false
  }
];

// ── Unit conversion ───────────────────────────────────────────────────────────

function closestVolumeUnit(ml) {
  if (ml < 5)   return { amount: parseFloat((ml / 5).toFixed(2)), unit: 'tl' };
  if (ml < 20)  return { amount: parseFloat((ml / 5).toFixed(2)), unit: 'tl' };
  if (ml < 60)  return { amount: parseFloat((ml / 15).toFixed(2)), unit: 'rkl' };
  if (ml < 900) return { amount: parseFloat((ml / 100).toFixed(2)), unit: 'dl' };
  return { amount: parseFloat((ml / 1000).toFixed(3)), unit: 'l' };
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
  if (u === 'cup' || u === 'cups')                              ml = a * 240;
  if (u === 'fl oz' || u === 'fl.oz' || u === 'fluid oz' || 
    u === 'fluid ounce' || u === 'fluid ounces')                ml = a * 29.57;
  if (u === 'pint' || u === 'pints' || u === 'pt')              ml = a * 473;
  if (u === 'quart' || u === 'quarts' || u === 'qt')            ml = a * 946;
  if (u === 'gallon' || u === 'gallons' || u === 'gal')         ml = a * 3785;

  if (ml !== null) {
    const { amount: ca, unit: cu } = closestVolumeUnit(ml);
    return { ...ing, amount: ca, unit: cu, original: `${a} ${ing.unit}` };
  }

  return { ...ing, original: null };
}

function convertRecipeUnits(recipe) {
  const ingredients = Object.fromEntries(
    Object.entries(recipe.ingredients).map(([header, ings]) => [
      header,
      ings.map(convertIngredient)
    ])
  );
  const hasConversions = Object.values(ingredients).flat().some(i => i.original);
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
    Object.values(x.ingredients).flat().some(i => i.name.toLowerCase().includes(searchQ.toLowerCase()))
  );
  if (ingFilter) {
    const ings = ingFilter.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    if (ings.length > 0) {
      r = r.filter(x => ings.every(i => Object.values(x.ingredients).flat().some(ing => ing.name.toLowerCase().includes(i))));
    }
  }
  return r;
}

function fmtAmount(amount, mult) {
  const v = amount * mult;
  return v % 1 === 0 ? v : parseFloat(v.toFixed(2));
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  const browseTab  = document.getElementById('browse-tab');
  const addTab     = document.getElementById('add-tab');
  const detailTab  = document.getElementById('detail-tab');

  browseTab.style.display  = 'none';
  addTab.style.display     = 'none';
  detailTab.style.display  = 'none';

  if (view === 'browse') {
    browseTab.style.display = 'block';
    renderSearch();
    renderPills();
    renderResults();
  } else if (view === 'add') {
    addTab.style.display = 'block';
    renderAdd();
  } else if (view === 'detail') {
    detailTab.style.display = 'block';
    renderDetail();
  } else if (view === 'edit') {
    addTab.style.display = 'block';
    renderEdit();
  }

  attachEvents();
}

function renderSearch() {
  const div = document.getElementById('browse-search');
  div.innerHTML = `
    <div class="topbar">
      <h1><i class="ti ti-chef-hat" aria-hidden="true" style="margin-right:8px"></i>${language.Browse_head}</h1>
      <div style="display:flex;gap:8px">
        <button class="view-btn active" data-v="browse" onclick=debug();><i class="ti ti-layout-grid"></i></button>
        <button class="view-btn" data-v="add"><i class="ti ti-plus"></i> ${language.Add}</button>
      </div>
    </div>
    <div class="search-row">
      <input type="text" placeholder="${language.Browse_search_1}" id="sq" value="${searchQ}">
    </div>
    <span class="ing-label">${language.Browse_search_span}</span>
    <input type="text" placeholder="${language.Browse_search_2}" id="iq" value="${ingFilter}">
  `;
}

function renderPills() {
  const div = document.getElementById('browse-pills');
  div.innerHTML = `
    <div class="filter-row">
      <button class="tag-btn${filterTag === 'all' ? ' active' : ''}" data-tag="all">${language.All}</button>
      <button class="tag-btn${filterTag === 'savory' ? ' active' : ''}" data-tag="savory">${language.Savory}</button>
      <button class="tag-btn${filterTag === 'sweet' ? ' active' : ''}" data-tag="sweet">${language.Sweet}</button>
    </div>
  `;
}

function renderResults() {
  // im in card <div class="recipe-card" data-id="${r.id}" ${r.image ? `style="background-image:url('${r.image}');background-size:cover;background-position:center;"` : ''}>
  const tags = allTags();
  const list = filteredRecipes();
  const div = document.getElementById('browse-results');
  div.innerHTML = `
    ${list.length === 0
      ? `<div class="empty"><i class="ti ti-inbox" aria-hidden="true"></i>${language.Browse_noresult}</div>`
      : `<div class="grid">${list.map(r => `
          <div class="recipe-card" data-id="${r.id}">
            <h3>${r.name}</h3>
            <div class="meta"><i class="ti ti-clock" aria-hidden="true"></i> ${r.time} min &nbsp;<i class="ti ti-users" aria-hidden="true"></i> ${r.servings}</div>
            <div class="tags">${r.tags.map(t => `<span class="pill">${t}</span>`).join('')}</div>
          </div>`).join('')}
        </div>`
    }`;
}

function debug() {
  recipes = JSON.parse(localStorage.getItem('recipe_manager_v1'));
  recipes = recipes.filter(x => x.id !== 'r111111111111111'); // replace with the actual id
  //recipes = recipes.filter(x => x.id !== 'r1781776548504');
  //recipes = recipes.filter(x => x.id !== 'r1781771903948');
  localStorage.setItem('recipe_manager_v1', JSON.stringify(recipes));
  location.reload();
}

function renderAdd() {
  const div = document.getElementById('add-tab');
  div.innerHTML = `
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
        Click to upload images
      </div>
      <input type="file" id="file-input" accept="image/*" multiple>
      <div id="img-preview" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;"></div>
      <div class="btn-row">
        <button class="btn-primary" id="parse-btn">
          <i class="ti ti-wand" aria-hidden="true"></i> Parse with AI
        </button>
      </div>
      <div class="status" id="parse-status"></div>
    </div>`;
}

function renderDetail() {
  //<span class="ing-amount">${i.amounts.map(a => `${fmtAmount(a.amount, mult)} ${a.unit}`).join(' / ')}</span>
  const r = getRecipes().find(x => x.id === detailId);
  const div = document.getElementById('detail-tab');
  if (!r) { view = 'browse'; render(); return; }
  const mult = servingsMultiplier;
  const isUser = recipes.find(x => x.id === detailId);
  div.innerHTML = `
    <div class="topbar">
      <button class="view-btn" data-v="browse"><i class="ti ti-arrow-left"></i> ${language.Back}</button>
      <h1>${r.name}</h1>
      ${isUser ? `
        <button class="btn-danger" id="delete-btn" aria-label="Delete recipe"><i class="ti ti-trash" aria-hidden="true"></i></button>
        <button class="view-btn" id="edit-btn" onclick="view='edit';render();" aria-label="Edit recipe"><i class="ti ti-edit"></i></button>
      ` : ''}
    </div>

    <div class="detail">

      ${r.image ? `<img src="${r.image}" style="width:100%;max-height:220px;object-fit:cover;border-radius:12px;margin-bottom:12px">` : ''}

      <div class="detail-meta">
        <span><i class="ti ti-clock" aria-hidden="true"></i>${r.time} min</span>
        ${r.tags.map(t => `<span class="pill">${t}</span>`).join('')}
      </div>
      ${r.hasConversions ? `

        <div class="conversion-notice">
          <i class="ti ti-refresh" aria-hidden="true"></i>
          ${language.Deatails_UnitsConverted}
        </div>` : ''}

      <div class="servings-ctrl">
        <span>${language.Details_Servings}</span>
        <button class="sctl-btn" id="serv-down" aria-label="Fewer servings">−</button>
        <span class="count" id="serv-count">${Math.round(r.servings * mult)}</span>
        <button class="sctl-btn" id="serv-up" aria-label="More servings">+</button>
      </div>

      <div>
        <h3 style="font-size:16px;font-weight:500;margin-bottom:12px">${language.Details_Ingredients}</h3>
        <div class="ingredients-list">
          ${Object.entries(r.ingredients).map(([header, ings]) => `
            ${header !== 'none' ? `<div class="ing-header">${header}</div>` : ''}
            ${ings.map(i => `
              <div class="ing-row">
                <span class="ing-amount">
                  ${i.amounts.map(a => a.amount === 0 ? '' : `${fmtAmount(a.amount, mult)} ${a.unit}`)
                    .filter(Boolean).join(' / ')}
                </span>
                <span>${i.name}</span>
              </div>`).join('')}
          `).join('')}
        </div>
      </div>

      <div>
        <h3 style="font-size:16px;font-weight:500;margin-bottom:12px">${language.Details_Instructions}</h3>
        <div class="steps-list">
          ${(() => {
            let counter = 1;
            return Object.entries(r.steps).map(([header, steps]) => `
              ${header !== 'none' ? `<div class="ing-header">${header}</div>` : ''}
              ${steps.map(s => `
                <div class="step-row">
                  <div class="step-num">${counter++}</div>
                  <div class="step-text">${s}</div>
                </div>`).join('')}
            `).join('');
          })()}
        </div>
      </div>
    </div>`;
}

function renderEdit() {
  const r = getRecipes().find(x => x.id === detailId);
  if (!r) { view = 'browse'; render(); return; }
  const div = document.getElementById('add-tab');
  div.innerHTML = `
    <div class="topbar">
      <button class="view-btn" data-v="detail"><i class="ti ti-arrow-left"></i> ${language.Back}</button>
      <h1>Edit recipe</h1>
    </div>
    <div class="panel">
      <label>Recipe image (optional)</label>
      <div class="upload-area" id="upload-area">
        <i class="ti ti-camera" aria-hidden="true"></i>
        ${r.image ? 'Replace image' : 'Click to upload an image'}
      </div>
      <input type="file" id="file-input" accept="image/*">
      <div id="img-preview" style="margin-top:8px">
        ${r.image ? `<img src="${r.image}" style="max-width:120px;max-height:120px;border-radius:8px;border:0.5px solid rgba(0,0,0,0.12)">` : ''}
      </div>

      <label>Name</label>
      <input type="text" id="edit-name" value="${r.name}">
      <label>Time (min)</label>
      <input type="number" id="edit-time" value="${r.time}">
      <label>Servings</label>
      <input type="number" id="edit-servings" value="${r.servings}">
      <label>Ingredients (one per line: amount unit name)</label>

      <textarea id="edit-ingredients">${
        Object.entries(r.ingredients).map(([h, ings]) =>
          (h !== 'none' ? `[${h}]\n` : '') +
          ings.map(i => i.amounts.map(a => `${a.amount} ${a.unit}`).join(' / ') + ' | ' + i.name).join('\n')
        ).join('\n\n')
      }</textarea>
      <label>Steps (one per line)</label>
      <textarea id="edit-steps">${
        Object.entries(r.steps).map(([h, steps]) =>
          (h !== 'none' ? `[${h}]\n` : '') + steps.join('\n')
        ).join('\n\n')
      }</textarea>
      <div class="btn-row">
        <button class="btn-primary" id="save-edit-btn">Save</button>
      </div>
    </div>`;
}

function saveEdit() {
  const r = getRecipes().find(x => x.id === detailId);

  const parseSection = (text) => {
    const result = {};
    let header = 'none';
    text.split('\n').forEach(line => {
      line = line.trim();
      if (!line) return;
      const m = line.match(/^\[(.+)\]$/);
      if (m) { header = m[1]; return; }
      if (!result[header]) result[header] = [];
      result[header].push(line);
    });
    return result;
  };

  const rawIngs = parseSection(document.getElementById('edit-ingredients').value);
  const ingredients = Object.fromEntries(
    Object.entries(rawIngs).map(([h, lines]) => [h,
      lines.map(line => {
        const [amountsPart, ...nameParts] = line.split('|');
        const name = nameParts.join('|').trim();
        const amounts = amountsPart.split('/').map(s => {
          const [amount, unit] = s.trim().split(' ');
          return { amount: parseFloat(amount) || 0, unit: unit || '' };
        });
        return { name, amounts };
      })
    ])
  );

  let image = r.image || null;
  const newImg = document.getElementById('img-preview')?.querySelector('img');
  if (newImg && newImg.src.startsWith('data:')) image = newImg.src;

  const updated = {
    ...r,
    name: document.getElementById('edit-name').value,
    image,
    time: parseInt(document.getElementById('edit-time').value) || r.time,
    servings: parseInt(document.getElementById('edit-servings').value) || r.servings,
    ingredients,
    steps: parseSection(document.getElementById('edit-steps').value),
    hasConversions: false
  };

  recipes = recipes.map(x => x.id === detailId ? updated : x);
  saveRecipes(recipes);
  view = 'detail';
  render();
}

// ── Events ────────────────────────────────────────────────────────────────────

// Tag filters
document.getElementById('browse-pills').addEventListener('click', e => {
  const btn = e.target.closest('[data-tag]');
  if (btn) {
    filterTag = btn.dataset.tag;
    renderPills();
    renderResults();
  }
});

// Recipe card click
document.getElementById('browse-results').addEventListener('click', e => {
  const card = e.target.closest('[data-id]');
  if (card) {
    detailId = card.dataset.id;
    servingsMultiplier = 1;
    view = 'detail';
    render();
  }
});

// Search
const sq = document.getElementById('sq');
if (sq) sq.addEventListener('input', e => {
  searchQ = e.target.value;
  renderResults();
});

// Ingredient filter
const iq = document.getElementById('iq');
if (iq) iq.addEventListener('input', e => {
  ingFilter = e.target.value;
  renderResults();
});

function attachEvents() {
  // Navigation
  document.querySelectorAll('[data-v]').forEach(b => {
    b.addEventListener('click', () => {
      view = b.dataset.v;
      if (view === 'browse') { servingsMultiplier = 1; ingFilter = ''; }
      render();
    });
  });

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

  // Edit recipe
  //const eb = document.getElementById('edit-btn');
  //if (eb) eb.addEventListener('click', () => { view = 'edit'; render(); });

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

  // Save edit
  const sb = document.getElementById('save-edit-btn');
  if (sb) sb.addEventListener('click', saveEdit);

  // Image upload
  const ua = document.getElementById('upload-area');
  const fi = document.getElementById('file-input');
  if (ua && fi) {
    ua.addEventListener('click', () => fi.click());
    fi.addEventListener('change', e => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      const prev = document.getElementById('img-preview');
      
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
          uploadedImages.push({ data: ev.target.result.split(',')[1], type: file.type || 'image/jpeg' });
          if (prev) prev.innerHTML += `<img src="${ev.target.result}" style="max-width:120px;max-height:120px;border-radius:8px;border:0.5px solid rgba(0,0,0,0.12)">`;
        };
        reader.readAsDataURL(file);
      });

      const ua2 = document.getElementById('upload-area');
      if (ua2) ua2.innerHTML = `<i class="ti ti-check" aria-hidden="true"></i> ${files.length} image(s) selected`;
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

  if (!text && uploadedImages.length === 0) {
    status.textContent = 'Please paste text or upload an image first.';
    return;
  }

  btn.disabled = true;
  status.textContent = 'Parsing with AI…';

  const userContent = [];

  uploadedImages.forEach(img => {
    userContent.push({ type: 'image', source: { type: 'base64', media_type: img.type, data: img.data } });
  });

  if (text) {
    userContent.push({ type: 'text', text });
  }
  userContent.push({
    type: 'text',
    text: `Extract the recipe and return ONLY a JSON object (no markdown, no backticks) with this exact shape:
{"name":"string","servings":number,"time":number,"tags":["string"],"ingredients":{"Header name":[{"name":"string","amounts":[{"amount":number,"unit":"string"}]}]},"steps":{"Section name":["string"]}}
- time: integer in total minutes (estimate if not given, no unit)
- tags: 'sweet' or 'savory' (Only one!)
- ingredients is an object where keys are section headers (use "none" if no sections)
- if an ingredient has multiple amounts/units (e.g. "5dl (300g)"), list each as a separate object in amounts
- if only one amount, amounts still has just one entry
- unit: can be g, kg, ml, l, tbsp, tsp, tl, rkl, dl, cup, oz, lb, fl oz, or empty string for countable items — preserve the original unit from the source exactly, do not convert units yourself
- steps is an object where keys are section headers (use "none" if no sections), do not include step numbers`
  });

  try {
    const res = await fetch('http://localhost:3000', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: userContent }]
      })
    });
    const data = await res.json();
    console.log(data.content[0].text);
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
    uploadedImages = [];
    view = 'detail';
    render();
  } catch (e) {
    status.textContent = 'Could not parse recipe. Try pasting more text, or a clearer image.';
    btn.disabled = false;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

render();