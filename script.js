const { createClient } = supabase;
const sb = createClient(
  'https://kyduskguhdbckoboqmmf.supabase.co',
  'sb_publishable_5izcObBiFo5KAu-TRtakDg_eCxg03cF'
);

async function unlock() {
    const email = document.getElementById('email-input').value
    const password = document.getElementById('lock-input').value;
    const errEl = document.getElementById('lock-error');
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
        errEl.textContent = 'Väärä salasana.';
        errEl.style.display = 'block';
        document.getElementById('lock-input').value = '';
        document.getElementById('lock-input').focus();
    } else {
        showApp();
    }
}

async function logout() {
    await sb.auth.signOut();
    document.getElementById('app').style.display = 'none';
    document.getElementById('lock-screen').style.display = 'flex';
}

async function showApp() {
    document.getElementById('lock-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('email-input').value = '';
    document.getElementById('lock-input').value = '';
    await loadRecipes();
    console.log(recipes);
    render();
}

sb.auth.getSession().then(({ data: { session } }) => {
    if (session) showApp();
});


// -- load

async function loadRecipes() {
  const { data, error } = await sb.from('recipes').select('*').order('created_at');
  if (error) { console.error(error); return; }
  recipes = (data || []).map(row => row.recipe_item);
  console.log('Recipes loaded.');
}

async function saveRecipes(recipe) {
  const { data, error } = await sb
    .from('recipes')
    .upsert({ id: recipe.id, recipe_item: recipe })
    .select();
  if (error) { console.error(error); return null; }
  return data?.[0]?.recipe_item ?? null;
}

async function deleteRecipe(id) {
  const { error } = await sb.from('recipes').delete().eq('id', id);
  if (error) { console.error(error); return false; }
  return true;
}

const STORAGE_KEY = 'recipe_manager_v1';
const SESSION_KEY = 'recipe_manager_session_v1';

function loadRecipesLocal() {
  try {
    const d = localStorage.getItem(STORAGE_KEY);
    return d ? JSON.parse(d) : [];
  } catch { return []; }
}

function saveRecipesLocal(r) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
}

// Remembers which page (and which recipe / servings) you had open, so a reload
// lands you back where you were instead of resetting to the browse screen.
function loadSession() {
  try {
    const d = localStorage.getItem(SESSION_KEY);
    return d ? JSON.parse(d) : null;
  } catch { return null; }
}

function saveSession() {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ view, detailId, servingsMultiplier, filterTag }));
  } catch { /* storage unavailable — fail silently, app still works without persistence */ }
}

// ── State ─────────────────────────────────────────────────────────────────────

const VALID_VIEWS = ['browse', 'add', 'detail', 'edit'];
const session = loadSession();

let recipes = [];
let view = (session && VALID_VIEWS.includes(session.view)) ? session.view : 'browse';      // browse | add | detail | cook
let detailId = session?.detailId ?? null;
let servingsNum = '';
let cookingSteps = [];
let servingsMultiplier = session?.servingsMultiplier ?? 1;
let filterTag = session?.filterTag ?? 'all';
let searchQ = '';
let ingFilter = '';
let uploadedImages = [];

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

// ── Language ───────────────────────────────────────────────────────────────────

const langsList = 
{
  english: {
    Add: 'Add',
    All: 'All',
    Back: 'Back',

    Add_head: 'Add recipe',
    Add_importWai: 'Import with AI',
    Add_text_head: 'Paste recipe text',
    Add_text_placehold: 'Paste any recipe — from a website, a book, or just a description…',
    Add_img_head: 'Or upload an image of a recipe',
    Add_img_placehold: 'Click to upload images',
    Add_parseBtn: 'Parse with AI',

    Browse_head: 'Recipes',
    Browse_search_1: 'Search recipes or ingredients…',
    Browse_search_span: 'Filter by ingredients I have (comma-separated)',
    Browse_search_2: 'e.g. eggs, garlic, lemon',
    Browse_tags: ['savory', 'sweet'],
    Browse_noresult: 'No recipes match — try different filters or add one.',

    Details_Ingredients: 'Ingredients',
    Details_Instructions: 'Instructions',
    Deatails_UnitsConverted: 'Some units have been converted from imperial to metric. Original values shown in brackets.',
    Details_Servings: 'Servings',

    Lock_give_pass: 'Input password',
    Lock_head: 'Recipe archive',
    Lock_email: 'Email',
    Lock_logIn: 'Log in',
    Lock_pass: 'Password',
    Lock_tryAgain: 'Try again',

    LanguageBtn: 'Suomeksi',
    Images_selected: 'image selected',
    Images2_selected: 'images selected',

    Savory: 'savory',
    Sweet: 'sweet',

    ThemeD: 'Dark theme',
    ThemeL: 'Light theme'

      
  },

  finnish: {
    Add: 'Lisää',
    All: 'Kaikki',
    Back: 'Takaisin',

    Add_head: 'Lisää resepti',
    Add_importWai: 'Tuo ai:lla',
    Add_text_head: 'Liitä resepti tekstinä',
    Add_text_placehold: 'Liitä resepti — nettisibulta, kirjasta tai vain kuvaus...',
    Add_img_head: 'Tai lataa kuva reseptistä',
    Add_img_placehold: 'Klikkaa lisätäksesi kuvia',
    Add_parseBtn: 'Jäsennä AI:lla',

    Browse_head: 'Reseptit',
    Browse_search_1: 'Etsi reseptejä tai ainesosia…',
    Browse_search_span: 'Suodata ainesosien perusteella (erotetaan pilkulla)',
    Browse_search_2: 'esim. muna, valkosipuli, sitruuna',
    Browse_tags: ['suolainen', 'makea'],
    Browse_noresult: 'Ei tuloksia — yritä eri suodattimia.',

    Details_Ingredients: 'Ainesosat',
    Details_Instructions: 'Valmistusohjeet',
    Details_UnitsConverted: 'Joitain arvoja on muunnettu metrijärjestelmään. Alkuperäiset suluissa.',
    Details_Servings: 'Annokset',

    Lock_give_pass: 'Anna salasana',
    Lock_head: 'Resepti arkisto',
    Lock_email: 'Sähköposti',
    Lock_logIn: 'Kirjaudu sisään',
    Lock_pass: 'Salasana',
    Lock_tryAgain: 'Yritä uudelleen',

    LanguageBtn: 'In english',

    Images_selected: 'kuva valittu',
    Images2_selected: 'kuvia valittu',

    Savory: 'suolainen',
    Sweet: 'makea',

    ThemeD: 'Tumma teema',
    ThemeL: 'Vaalea teema'
  }
}

let currentLang = localStorage.getItem('language') ?? 'english';
let language = langsList[currentLang];

function changeLanguage(from) {
  currentLang = currentLang === 'english' ? 'finnish' : 'english';
  language = langsList[currentLang];
  localStorage.setItem('language', currentLang);

  // language btn
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.textContent = language.LanguageBtn;
  });

  // thmem btn
  const IsDark = localStorage.getItem('theme') === 'dark';
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.textContent = IsDark ? language.ThemeL : language.ThemeD;
  });

  from.id === 'lang-btn-l' ? renderLock() : render()
}

function initLanguage() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.textContent = language.LanguageBtn;
  });
}

// ── Translate units ───────────────────────────────────────────────────────────

function translateUnits(u) {
  if (localStorage.getItem('language') === 'finnish'){
    if (u === 'tsp') {return 'tl'};
    if (u === 'tbsp') {return 'rkl'};
  }
  else {
      if (u === 'tl') {return 'tsp'};
      if (u === 'rkl') {return 'tbsp'};
    }
  return u
}

// ── Unit conversion ───────────────────────────────────────────────────────────

function closestVolumeUnit(ml) {
  if (ml < 5)   return { amount: parseFloat((ml / 5).toFixed(2)), unit: 'tl' };
  if (ml < 20)  return { amount: parseFloat((ml / 5).toFixed(2)), unit: 'tl' };
  if (ml < 60)  return { amount: parseFloat((ml / 15).toFixed(2)), unit: 'rkl' };
  if (ml < 900) return { amount: parseFloat((ml / 100).toFixed(2)), unit: 'dl' };
  return { amount: parseFloat((ml / 1000).toFixed(3)), unit: 'l' };
}

function convertAmount(a) {
  const u = (a.unit || '').toLowerCase().trim();
  const amt = a.amount;

  // Weight: imperial → g
  if (u === 'oz' || u === 'ounce' || u === 'ounces') {
    return { amount: Math.round(amt * 28.35), unit: 'g', original: `${amt} ${a.unit}` };
  }
  if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') {
    return { amount: Math.round(amt * 453.59), unit: 'g', original: `${amt} ${a.unit}` };
  }

  // Volume: imperial → ml → closest metric label
  let ml = null;
  if (u === 'cup' || u === 'cups')                              ml = amt * 240;
  if (u === 'fl oz' || u === 'fl.oz' || u === 'fluid oz' || 
    u === 'fluid ounce' || u === 'fluid ounces')                ml = amt * 29.57;
  if (u === 'pint' || u === 'pints' || u === 'pt')              ml = amt * 473;
  if (u === 'quart' || u === 'quarts' || u === 'qt')            ml = amt * 946;
  if (u === 'gallon' || u === 'gallons' || u === 'gal')         ml = amt * 3785;

  if (ml !== null) {
    const { amount: ca, unit: cu } = closestVolumeUnit(ml);
    return { amount: ca, unit: cu, original: `${amt} ${a.unit}` };
  }

  return { ...a, original: null };
}

function convertIngredient(ing) {
  const [first, ...rest] = ing.amounts;
  return { ...ing, amounts: [convertAmount(first), ...rest] };
}

function convertRecipeUnits(recipe) {
  const ingredients = Object.fromEntries(
    Object.entries(recipe.ingredients).map(([header, ings]) => [
      header,
      ings.map(convertIngredient)
    ])
  );
  const hasConversions = Object.values(ingredients).flat().some(i => i.amounts[0]?.original);
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

// ── Lock screen ────────────────────────────────────────────────────────────────

function renderLock() {
  const texte = document.getElementById('email-input')?.value ?? '';
  const textp = document.getElementById('lock-input')?.value ?? '';
  const div = document.getElementById('lock-box');
  div.innerHTML = `
    <h2>${language.Lock_head}</h2>
    <p>${language.Lock_give_pass}</p>
    <input type="email" id="email-input" placeholder="${language.Lock_email}">
    <input type="password" id="lock-input" placeholder="${language.Lock_pass}">
    <button id="lock-btn" class="lock-btn" onclick="unlock()">${language.Lock_logIn}</button>
    <div id="lock-error" class="lock-error">${language.Lock_tryAgain}</div>
  `;
  document.getElementById('lock-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') unlock();
  });
  document.getElementById('email-input').value = texte;
  document.getElementById('lock-input').value = textp;
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
    servingsNum = '';
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
  saveSession();
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
            ${r.image ? `<div class="recipe-card-image" style="background-image:url('${r.image}')"></div>` : ''}
            <div class="recipe-card-body">
              <h3>${r.name}</h3>
              <div class="meta"><i class="ti ti-clock" aria-hidden="true"></i> ${r.time} min &nbsp;<i class="ti ti-users" aria-hidden="true"></i> ${r.servings}</div>
              <div class="tags">${r.tags.map(t => `<span class="pill${t === 'sweet' ? ' pill-sweet' : ''}">${t === 'sweet' ? language.Sweet : language.Savory}</span>`).join('')}</div>
            </div>
          </div>`).join('')}
        </div>`
    }`;
}

function debug() {
  recipes = JSON.parse(localStorage.getItem('recipe_manager_v1'));
  recipes = recipes.filter(x => x.id !== 'r1781989988750'); // replace with the actual id
  //recipes = recipes.filter(x => x.id !== 'r1781776548504');
  //recipes = recipes.filter(x => x.id !== 'r1781771903948');
  localStorage.setItem('recipe_manager_v1', JSON.stringify(recipes));
  location.reload();
}

function renderAdd() {
  const div = document.getElementById('add-tab');
  div.innerHTML = `
    <div class="topbar">
      <button class="back-btn" data-v="browse"><i class="ti ti-arrow-left"></i> ${language.Back}</button>
      <h1>${language.Add_head}</h1>
    </div>
    <div class="panel">
      <h2>${language.Add_importWai}</h2>
      <label>${language.Add_text_head}</label>
      <textarea id="paste-input" placeholder="${language.Add_text_placehold}"></textarea>
      <label>${language.Add_img_head}</label>
      <div class="upload-area" id="upload-area">
        <i class="ti ti-camera" aria-hidden="true"></i>
        ${language.Add_img_placehold}
      </div>
      <input type="file" id="file-input" accept="image/*" multiple>
      <div id="img-preview" class="add-img"></div>
      <div class="btn-row">
        <button class="btn-primary" id="parse-btn">
          <i class="ti ti-wand" aria-hidden="true"></i> ${language.Add_parseBtn}
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
  servingsMultiplier = servingsMultiplier === 0 ? 1 : servingsMultiplier
  servingsNum = servingsNum === '' ? 'x 1' : servingsNum

  div.innerHTML = `
    <div class="topbar">
      <button class="back-btn" data-v="browse"><i class="ti ti-arrow-left"></i> ${language.Back}</button>
      <h1>${r.name}</h1>
      ${isUser ? `
        <button class="btn-danger" id="delete-btn" aria-label="Delete recipe"><i class="ti ti-trash" aria-hidden="true"></i></button>
        <button class="view-btn" id="edit-btn" onclick="view='edit';render();" aria-label="Edit recipe"><i class="ti ti-edit"></i></button>
      ` : ''}
    </div>

    <div class="detail">

      ${r.image ? `<img src="${r.image}" class="de-img">` : ''}

      <div class="detail-meta">
        <span><i class="ti ti-clock" aria-hidden="true"></i>${r.time} min</span>
        ${r.tags.map(t => `<span class="pill${t === 'sweet' ? ' pill-sweet' : ''}">${t === 'sweet' ? language.Sweet : language.Savory}</span>`).join('')}
      </div>
      ${r.hasConversions ? `

        <div class="conversion-notice">
          <i class="ti ti-refresh" aria-hidden="true"></i>
          ${language.Deatails_UnitsConverted}
        </div>` : ''}

      <div class="servings-ctrl">
        <span>${language.Details_Servings}</span>
        <button class="sctl-btn" id="serv-down" aria-label="Fewer servings">−</button>
        <span class="count" id="serv-count">${servingsNum}</span>
        <button class="sctl-btn" id="serv-up" aria-label="More servings">+</button>
      </div>

      <div>
        <h3>${language.Details_Ingredients}</h3>
        <div class="ingredients-list">
          ${Object.entries(r.ingredients).map(([header, ings]) => `
            ${header !== 'none' ? `<div class="ing-head">${header}</div>` : ''}
            ${ings.map(i => `
              <div class="ing-row">
                <span class="ing-amount">
                  ${i.amounts.map(a => a.amount === 0 ? '' : `${fmtAmount(a.amount, mult)} ${translateUnits(a.unit)}`)
                    .filter(Boolean).join(' / ')}
                  ${i.amounts[0]?.original ? `<span class="original-unit">(${i.amounts[0].original})</span>` : ''}
                </span>
                <span>${i.name}</span>
              </div>`).join('')}
          `).join('')}
        </div>
      </div>

      <div>
        <h3>${language.Details_Instructions}</h3>
        <div class="steps-list">
          ${(() => {
            let counter = 1;
            return Object.entries(r.steps).map(([header, steps]) => `
              ${header !== 'none' ? `<div><h3>${header}</h3></div>` : ''}
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
      <button class="back-btn" data-v="detail"><i class="ti ti-arrow-left"></i> ${language.Back}</button>
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
      <input type="text" id="edit-name" maxlength="70" value="${r.name}">
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
      lines.map((line, idx) => {
        const [amountsPart, ...nameParts] = line.split('|');
        const name = nameParts.join('|').trim();

        // Find the matching ingredient from before the edit, by name first,
        // falling back to position so we can carry over `original` if unchanged.
        const prevIng = r.ingredients[h]?.find(p => p.name === name) || r.ingredients[h]?.[idx];

        const amounts = amountsPart.split('/').map((s, ai) => {
          const [amount, unit] = s.trim().split(' ');
          const parsedAmount = parseFloat(amount) || 0;
          const parsedUnit = unit || '';
          const prevAmt = prevIng?.amounts?.[ai];
          const original = (prevAmt && prevAmt.amount === parsedAmount && prevAmt.unit === parsedUnit)
            ? prevAmt.original
            : null;
          return { amount: parsedAmount, unit: parsedUnit, original };
        });

        return { name, amounts };
      })
    ])
  );

  const hasConversions = Object.values(ingredients).flat().some(i => i.amounts[0]?.original);

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
    hasConversions
  };

  recipes = recipes.map(x => x.id === detailId ? updated : x);
  saveRecipes(updated);
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
    const raw = card.dataset.id;
    detailId = isNaN(raw) ? raw : Number(raw);  // keep 's1'/'s2' as strings, convert number ids
    servingsMultiplier = 1;
    view = 'detail';
    render();
  }
});

function attachEvents() {
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

  // Navigation
  document.querySelectorAll('[data-v]').forEach(b => {
    b.addEventListener('click', () => {
      view = b.dataset.v;
      if (view === 'browse') { servingsMultiplier = 1; ingFilter = ''; }
      render();
    });
  });

  // Servings amounts
  /*const r = getRecipes().find(x => x.id === detailId);
  const s = r ? r.servings : NaN1
  const sd = document.getElementById('serv-down');
  if (r && s === 'none') sd.addEventListener('click', () => {
    const cur = servingsMultiplier;
    if (cur >= 0.1) servingsMultiplier = cur / 2;
    servingsNum = 'x' + ' ' + servingsMultiplier;
    render();
  });
  else if (sd) sd.addEventListener('click', () => {
    const cur = Math.round(s * servingsMultiplier);
    if (cur > 1) servingsMultiplier = (cur - 1) / r.servings;
    servingsNum = Math.round(s * servingsMultiplier)
    render();
  });

  const su = document.getElementById('serv-up');
  if (r && s === 'none') su.addEventListener('click', () => {
    const cur = servingsMultiplier;
    if (cur <= 20) servingsMultiplier = cur + 1;
    servingsNum = 'x' + ' ' + servingsMultiplier;
    render();
  });
  else if (su) su.addEventListener('click', () => {
    const cur = Math.round(s * servingsMultiplier);
    servingsMultiplier = (cur + 1) / s;
    servingsNum = Math.round(s * servingsMultiplier)
    render();
  });*/

  // Servings multiply
  const r = getRecipes().find(x => x.id === detailId);
  const sd = document.getElementById('serv-down');
  if (r && sd) sd.addEventListener('click', () => {
    const cur = servingsMultiplier;
    if (cur > 0.1) {
      if (cur <= 2 && cur > 0.25) {servingsMultiplier = cur - 0.25}
      else if (cur > 2) {servingsMultiplier = cur - 1}
      else if (cur === 0.25) {servingsMultiplier = 0.1}
      servingsNum = 'x' + ' ' + servingsMultiplier;
      render();
    }
  });

  const su = document.getElementById('serv-up');
  if (r && su) su.addEventListener('click', () => {
    const cur = servingsMultiplier;
    if (cur < 10) {
      if (cur < 2 && cur >=0.25) {servingsMultiplier = cur + 0.25}
      else if (cur >= 2) {servingsMultiplier = cur + 1}
      else if (cur === 0.1) {servingsMultiplier = 0.25}
      servingsNum = 'x' + ' ' + servingsMultiplier;
      render();
    }
  });

  // Edit recipe
  //const eb = document.getElementById('edit-btn');
  //if (eb) eb.addEventListener('click', () => { view = 'edit'; render(); });

  // Delete recipe
  const db = document.getElementById('delete-btn');
  if (db) db.addEventListener('click', async () => {
    const ok = await deleteRecipe(detailId);
    if (ok) {
      recipes = recipes.filter(x => x.id !== detailId);
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

      let loaded = 0;
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
          uploadedImages.push({ data: ev.target.result.split(',')[1], type: file.type || 'image/jpeg' });
          loaded++;
          if (loaded === files.length) {
            renderImagePreviews();
            updateUploadAreaLabel();
          }
        };
        reader.readAsDataURL(file);
      });

      fi.value = ''; // allows re-selecting the same file later
    });
  }

  // Parse button
  const pb = document.getElementById('parse-btn');
  if (pb) pb.addEventListener('click', parseRecipe);
}

// ── Image upload ────────────────────────────────────────────────────────────────

function renderImagePreviews() {
  const prev = document.getElementById('img-preview');
  if (!prev) return;
  prev.innerHTML = uploadedImages.map((img, i) => `
    <div class="img-thumb">
      <img src="data:${img.type};base64,${img.data}">
      <button type="button" class="img-remove-btn" data-index="${i}" aria-label="Remove image">&times;</button>
    </div>
  `).join('');

  prev.querySelectorAll('.img-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      uploadedImages.splice(idx, 1);
      renderImagePreviews();
      updateUploadAreaLabel();
    });
  });
}

function updateUploadAreaLabel() {
  const ua2 = document.getElementById('upload-area');
  if (!ua2) return;
  if (uploadedImages.length === 0) {
    ua2.innerHTML = `<i class="ti ti-upload" aria-hidden="true"></i> ${language.Add_img_placehold}`; // adjust to your default label
  } else {
    ua2.innerHTML = `<i class="ti ti-check" aria-hidden="true"></i> ${uploadedImages.length} ${uploadedImages.length > 1 ? language.Images2_selected : language.Images_selected}`;
  }
}

// ── AI Parsing ────────────────────────────────────────────────────────────────

async function parseRecipe() {
  const text = document.getElementById('paste-input')?.value || '';
  const status = document.getElementById('parse-status');
  const btn = document.getElementById('parse-btn');

  if (!text && uploadedImages.length === 0) {
    status.textContent = 'Please paste text or upload an image first.';
    status.classList.add('status-error');
    return;
  }

  btn.disabled = true;
  status.textContent = 'Parsing with AI…';
  status.classList.remove('status-error');

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
{"name":"string","time":number,"tags":["string"],"ingredients":{"Header name":[{"name":"string","amounts":[{"amount":number,"unit":"string"}]}]},"steps":{"Section name":["string"]}}
- time: integer in total minutes (estimate if not given, no unit)
- tags: 'sweet' or 'savory' (Only one!)
- ingredients is an object where keys are section headers (use "none" if no sections)
- if an ingredient has multiple amounts/units (e.g. "5dl (300g)"), list each as a separate object in amounts
- if only one amount, amounts still has just one entry
- unit: can be g, kg, ml, l, tbsp, tsp, tl, rkl, dl, cup, oz, lb, fl oz, or empty string for countable items — preserve the original unit from the source exactly, do not convert units yourself
- steps is an object where keys are section headers (use "none" if no sections), do not include step numbers
- if steps mention imperial units (cup, °F, oz, tbsp, tsp, lb, pint, quart...), convert them to metric and show the original in brackets, e.g. "Preheat oven to 180°C (350°F)" — round temperatures to the nearest 5°C and volumes/weights to sensible cooking precision`
  });

  try {
    const res = await fetch(
      'https://kyduskguhdbckoboqmmf.supabase.co/functions/v1/claude-proxy',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          messages: [{ role: 'user', content: userContent }]
        })
      }
    );
    const data = await res.json();
    console.log(data.content[0].text);
    const raw = data.content.map(c => c.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // Convert imperial units to metric
    const converted = convertRecipeUnits(parsed);
    converted.id = Date.now()

    recipes.push(converted);
    saveRecipes(converted);
    detailId = converted.id;
    servingsMultiplier = 1;
    uploadedImages = [];
    view = 'detail';
    render();
  } catch (e) {
    status.textContent = 'Could not parse recipe. Try pasting more text, or a clearer image.';
    status.classList.add('status-error');
    btn.disabled = false;
  }
}

// ── Toggle theme ────────────────────────────────────────────────────────────────

function applyTheme() {
    const isDark = localStorage.getItem('theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.textContent = isDark ? language.ThemeL : language.ThemeD;
    });
}

function toggleTheme() {
    const isDark = localStorage.getItem('theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.textContent = newTheme === 'dark' ? language.ThemeL : language.ThemeD;
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────

applyTheme();
initLanguage();
renderLock();
