// main.js

const API_BASE = ""; // same origin to server.js
const imgBase = "https://image.tmdb.org/t/p/w500";

const authOverlay = document.getElementById("authOverlay");
const home = document.getElementById("home");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const showRegister = document.getElementById("showRegister");
const showLogin = document.getElementById("showLogin");
const authMessage = document.getElementById("authMessage");
const registerMessage = document.getElementById("registerMessage");
const logoutBtn = document.getElementById("logoutBtn");
const hero = document.getElementById("hero");
const rowTrending = document.getElementById("rowTrending");
const rowTopRated = document.getElementById("rowTopRated");
const rowAction = document.getElementById("rowAction");
const rowComedy = document.getElementById("rowComedy");
const posterGridBg = document.getElementById("posterGridBg");

const state = {
  user: null,
  token: null,
};

function setToken(token) {
  state.token = token;
  if (token) localStorage.setItem("af_token", token);
  else localStorage.removeItem("af_token");
}

function getToken() {
  return state.token || localStorage.getItem("af_token");
}

async function me() {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${getToken() || ""}` },
  });
  if (!res.ok) return null;
  return res.json();
}

function showAuth() {
  authOverlay.classList.remove("hidden");
  home.classList.add("hidden");
  buildBlurGrid(); // populate blurred movie grid tiles
}

function showHome() {
  authOverlay.classList.add("hidden");
  home.classList.remove("hidden");
}

showRegister.addEventListener("click", () => {
  loginForm.classList.add("hidden");
  registerForm.classList.remove("hidden");
  authMessage.textContent = "";
  registerMessage.textContent = "";
});

showLogin.addEventListener("click", () => {
  registerForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
  authMessage.textContent = "";
  registerMessage.textContent = "";
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authMessage.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Login failed");
    setToken(data.token);
    state.user = data.user;
    await loadHome();
    showHome();
  } catch (err) {
    authMessage.textContent = err.message;
  }
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  registerMessage.textContent = "";

  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;

  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Registration failed");
    registerMessage.textContent = "Account created. You can sign in now.";
    // swap to login
    setTimeout(() => {
      showLogin.click();
    }, 800);
  } catch (err) {
    registerMessage.textContent = err.message;
  }
});

logoutBtn.addEventListener("click", async () => {
  setToken(null);
  state.user = null;
  showAuth();
});

async function init() {
  const token = getToken();
  if (token) {
    const user = await me();
    if (user) {
      state.user = user;
      await loadHome();
      showHome();
      return;
    }
  }
  showAuth();
}

async function buildBlurGrid() {
  // Fetch a bunch of trending posters to build the blurred grid
  try {
    const res = await fetch(`${API_BASE}/api/movies/trending`);
    const data = await res.json();
    posterGridBg.innerHTML = "";
    const tiles = (data.results || []).slice(0, 64);
    tiles.forEach((m) => {
      const div = document.createElement("div");
      div.className = "tile";
      if (m.poster_path) {
        div.style.backgroundImage = `url(${imgBase}${m.poster_path})`;
      } else {
        div.style.background = "#111";
      }
      posterGridBg.appendChild(div);
    });
  } catch (e) {
    // fallback empty
  }
}

async function loadHome() {
  const [trending, topRated, action, comedy] = await Promise.all([
    fetchJSON("/api/movies/trending"),
    fetchJSON("/api/movies/top-rated"),
    fetchJSON("/api/movies/genre/28"), // Action
    fetchJSON("/api/movies/genre/35"), // Comedy
  ]);

  renderHero(trending?.results?.[0]);
  renderRow(rowTrending, trending?.results || []);
  renderRow(rowTopRated, topRated?.results || []);
  renderRow(rowAction, action?.results || []);
  renderRow(rowComedy, comedy?.results || []);
}

function renderHero(item) {
  if (!item) {
    hero.style.backgroundImage = "none";
    hero.innerHTML = "";
    return;
  }
  const backdrop = item.backdrop_path ? `url(https://image.tmdb.org/t/p/original${item.backdrop_path})` : "none";
  hero.style.backgroundImage = backdrop;
  hero.innerHTML = `
    <div class="hero-content">
      <h1 class="hero-title">${escapeHTML(item.title || item.name || "Untitled")}</h1>
      <p class="hero-overview">${escapeHTML(item.overview || "")}</p>
      <div style="margin-top:12px;">
        <button class="btn btn-primary">Play</button>
        <button class="btn btn-outline" style="margin-left:8px;">More Info</button>
      </div>
    </div>
  `;
}

function renderRow(container, items) {
  container.innerHTML = "";
  items.forEach((m) => {
    const card = document.createElement("div");
    card.className = "card";
    const imgSrc = m.poster_path ? `${imgBase}${m.poster_path}` : "";
    card.innerHTML = `
      <img src="${imgSrc}" alt="${escapeHTML(m.title || m.name || "Poster")}">
      <div class="badge">${(m.media_type || "Movie").toUpperCase()}</div>
    `;
    container.appendChild(card);
  });
}

async function fetchJSON(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

function escapeHTML(str = "") {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[c]);
}

// boot
init();
