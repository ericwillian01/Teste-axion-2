/* ============================================================
   AXION FINANCE — SCRIPT.JS
   Módulos: State | UI | Logic
   ============================================================ */

'use strict';

/* ============================================================
   MODULE: STATE — Controle de dados e localStorage
   ============================================================ */
const State = (() => {

  // Chave no localStorage
  const KEY = 'axion_data_v2';

  // Estrutura de dados padrão
  const DEFAULT = {
    salary: 0,
    userName: 'Usuário',
    investorProfile: 'moderado',
    expenses: [],
    investments: [],          // ← portfólio de aportes
    categories: [
      { id: 'mercado',    name: 'Mercado',     color: '#4FC3F7', limit: 30 },
      { id: 'lazer',      name: 'Lazer',       color: '#FF8A65', limit: 15 },
      { id: 'transporte', name: 'Transporte',  color: '#A5D6A7', limit: 15 },
      { id: 'saude',      name: 'Saúde',       color: '#CE93D8', limit: 10 },
      { id: 'educacao',   name: 'Educação',    color: '#FFF176', limit: 10 },
    ],
    goals: [],
    settings: {
      theme: 'dark',
      alertLimit: true,
      alertInsight: true,
    },
    onboardingDone: false,
    onboardingStep: 1,
  };

  let data = {};

  // Carrega dados do localStorage
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT };
      // Garante arrays
      if (!Array.isArray(data.expenses)) data.expenses = [];
      if (!Array.isArray(data.investments)) data.investments = [];
      if (!Array.isArray(data.categories)) data.categories = [...DEFAULT.categories];
      if (!Array.isArray(data.goals)) data.goals = [];
    } catch (e) {
      console.warn('Axion: erro ao carregar dados', e);
      data = { ...DEFAULT };
    }
  }

  // Salva dados no localStorage
  function save() {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  // Getters
  function get() { return data; }
  function getSalary() { return data.salary || 0; }
  function getExpenses() { return data.expenses || []; }
  function getCategories() { return data.categories || []; }
  function getGoals() { return data.goals || []; }
  function getProfile() { return data.investorProfile || 'moderado'; }
  function getInvestments() { return data.investments || []; }

  // Onboarding
  function startOnboarding() {
    document.getElementById('onboarding-overlay').classList.remove('hidden');
    _syncOnboardingUI(1);
  }

  function nextOnboarding() {
    const step = data.onboardingStep || 1;
    if (step === 2) {
      const val = parseFloat(document.getElementById('onboard-salary').value);
      if (!val || val <= 0) { UI.toast('Informe um salário válido', 'error'); return; }
      data.salary = val;
    }
    data.onboardingStep = step + 1;
    _syncOnboardingUI(step + 1);
  }

  function finishOnboarding() {
    const profileEl = document.querySelector('input[name="profile"]:checked');
    if (profileEl) data.investorProfile = profileEl.value;
    data.onboardingDone = true;
    save();
    document.getElementById('onboarding-overlay').classList.add('hidden');
    UI.init();
  }

  function _syncOnboardingUI(step) {
    document.querySelectorAll('.onboarding-step').forEach(el => {
      el.classList.toggle('active', parseInt(el.dataset.step) === step);
    });
    document.querySelectorAll('.dot').forEach(dot => {
      dot.classList.toggle('active', parseInt(dot.dataset.dot) === step);
    });
  }

  return { load, save, get, getSalary, getExpenses, getCategories, getGoals, getProfile,
           getInvestments, startOnboarding, nextOnboarding, finishOnboarding };
})();


/* ============================================================
   MODULE: UI — Renderização de componentes
   ============================================================ */
const UI = (() => {

  // Referências de gráficos
  let _dashDonut = null;
  let _chartBar = null;
  let _chartPie = null;
  let _chartLine = null;
  let _simChart = null;

  // ===== INIT =====
  function init() {
    const d = State.get();

    // Aplicar tema
    document.body.setAttribute('data-theme', d.settings.theme || 'dark');
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.checked = (d.settings.theme !== 'light');

    // Update sidebar user
    const avatar = document.getElementById('sidebar-avatar');
    if (avatar) avatar.textContent = (d.userName || 'U')[0].toUpperCase();
    const sName = document.getElementById('sidebar-profile-name');
    if (sName) sName.textContent = d.userName || 'Usuário';
    const sType = document.getElementById('sidebar-profile-type');
    if (sType) sType.textContent = _profileLabel(d.investorProfile);

    // Settings inputs
    const ss = document.getElementById('settings-salary');
    if (ss) ss.value = d.salary || '';
    const sn = document.getElementById('settings-name');
    if (sn) sn.value = d.userName || '';

    // Alert toggles
    const al = document.getElementById('alert-limit');
    if (al) al.checked = d.settings.alertLimit !== false;
    const ai = document.getElementById('alert-insight');
    if (ai) ai.checked = d.settings.alertInsight !== false;

    // Greeting
    _updateGreeting();

    // Renderizar páginas
    renderDashboard();
    renderCategoryList();
    renderExpenses();
    renderPortfolio();
    renderGoals();
    renderInvestments();

    // Sync drawer inputs
    const dSalary = document.getElementById('drawer-salary');
    if (dSalary) dSalary.value = d.salary || '';
    const dTheme = document.getElementById('drawer-theme-toggle');
    if (dTheme) dTheme.checked = (d.settings.theme !== 'light');
    const dAlert = document.getElementById('drawer-alert-limit');
    if (dAlert) dAlert.checked = d.settings.alertLimit !== false;

    // Nav event listeners
    _bindNav();

    // Set today's date in expense modal
    const dateInput = document.getElementById('expense-date');
    if (dateInput) dateInput.value = _today();

    // Set profile radio in investments page
    const profRadio = document.querySelector(`input[name="invest-profile"][value="${d.investorProfile}"]`);
    if (profRadio) profRadio.checked = true;
  }

  // ===== NAV =====
  function _bindNav() {
    document.querySelectorAll('[data-page]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        const page = el.dataset.page;
        if (!page) return;
        navigateTo(page);
      });
    });
  }

  function navigateTo(page) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
    document.querySelectorAll('.bnav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
    // Show page
    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === `page-${page}`);
    });
    // Re-render charts when navigating to chart page
    if (page === 'graficos') { setTimeout(() => renderCharts(), 50); }
    if (page === 'dashboard') { setTimeout(() => renderDashboard(), 50); }
    window.scrollTo(0, 0);
  }

  // ===== DASHBOARD =====
  function renderDashboard() {
    const salary = State.getSalary();
    const expenses = State.getExpenses();
    const investments = State.getInvestments();
    const filtered = _filterByMonth(expenses);
    const filteredInv = _filterByMonthArr(investments);
    const total = filtered.reduce((s, e) => s + e.value, 0);
    const totalInv = filteredInv.reduce((s, i) => s + i.value, 0);
    const balance = salary - total;
    const pct = salary > 0 ? (total / salary * 100) : 0;

    // KPIs with animated numbers
    _animateValue('kpi-salary', salary);
    _animateValue('kpi-balance', balance);
    _animateValue('kpi-spent', total);
    _setText('kpi-balance-pct', `${Math.max(0, (100 - pct)).toFixed(1)}% disponível`);
    _setText('kpi-spent-pct', `${pct.toFixed(1)}% do salário`);

    // Score
    const score = _calcScore(salary, total, totalInv, filtered);
    _renderScore(score);

    // Usage bar
    const bar = document.getElementById('usage-bar');
    const pctText = document.getElementById('usage-pct-text');
    if (bar) bar.style.width = `${Math.min(100, pct).toFixed(1)}%`;
    if (pctText) pctText.textContent = `${pct.toFixed(1)}%`;
    if (bar) {
      if (pct > 90) bar.style.background = 'linear-gradient(90deg, #FF3B3B, #FF6B6B)';
      else if (pct > 70) bar.style.background = 'linear-gradient(90deg, #FF8F00, #FFC107)';
      else bar.style.background = 'linear-gradient(90deg, #00E676, #69F0AE)';
    }

    // Projection badge
    const projEl = document.getElementById('usage-projection');
    if (projEl && salary > 0) {
      const today = new Date().getDate();
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const dailyRate = today > 0 ? total / today : 0;
      const projectedTotal = dailyRate * daysInMonth;
      const projPct = salary > 0 ? projectedTotal / salary * 100 : 0;
      projEl.textContent = `Projeção: ${projPct.toFixed(0)}% até fim do mês`;
    }

    // Multiple Insights
    _renderInsights(pct, filtered, salary, totalInv);

    // Projection card
    _renderProjection(salary, expenses);

    // Donut chart
    _renderDashDonut(filtered);

    // Recent list
    _renderRecentList(filtered);
  }

  // ===== ANIMATED NUMBER =====
  function _animateValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const target = value || 0;
    const formatted = _fmt(target);
    // If same value skip animation
    if (el.dataset.val === String(target)) return;
    el.dataset.val = String(target);
    el.classList.remove('animating');
    void el.offsetWidth; // reflow
    el.classList.add('animating');
    // Count-up animation
    const duration = 600;
    const start = performance.now();
    const startVal = parseFloat(el.dataset.prev || '0') || 0;
    el.dataset.prev = String(target);
    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      const current = startVal + (target - startVal) * eased;
      el.textContent = _fmt(current);
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = formatted;
    }
    requestAnimationFrame(step);
  }

  // ===== SCORE ENGINE =====
  function _calcScore(salary, spent, invested, expenses) {
    if (salary === 0) return null;
    let score = 100;

    // 1. Gastos vs salário (peso 50)
    const spentPct = spent / salary * 100;
    if (spentPct > 100) score -= 50;
    else if (spentPct > 90) score -= 40;
    else if (spentPct > 80) score -= 28;
    else if (spentPct > 70) score -= 18;
    else if (spentPct > 60) score -= 10;
    else if (spentPct > 50) score -= 4;

    // 2. Nível de investimento (peso 30)
    const invPct = invested / salary * 100;
    if (invPct >= 20) score += 0;       // já está no máximo
    else if (invPct >= 10) score -= 5;
    else if (invPct >= 5)  score -= 12;
    else score -= 20;

    // 3. Categorias acima do limite (peso 20)
    const cats = State.getCategories();
    const catSpend = {};
    expenses.forEach(e => { catSpend[e.catId] = (catSpend[e.catId] || 0) + e.value; });
    let overCount = 0;
    cats.forEach(c => {
      if (c.limit > 0) {
        const s = catSpend[c.id] || 0;
        if (s / salary * 100 > c.limit) overCount++;
      }
    });
    score -= overCount * 8;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function _renderScore(score) {
    const el = document.getElementById('kpi-score');
    const labelEl = document.getElementById('kpi-score-label');
    const canvas = document.getElementById('score-ring');
    if (!el) return;

    if (score === null) {
      el.textContent = '—';
      if (labelEl) labelEl.textContent = 'Configure salário';
      return;
    }

    el.textContent = score;

    let cls, label;
    if (score >= 85)      { cls = 'score-excellent'; label = 'Excelente 🏆'; }
    else if (score >= 70) { cls = 'score-good';      label = 'Bom 👍'; }
    else if (score >= 55) { cls = 'score-ok';        label = 'Regular ⚠️'; }
    else if (score >= 35) { cls = 'score-bad';       label = 'Atenção 🔴'; }
    else                  { cls = 'score-critical';  label = 'Crítico 🚨'; }

    el.className = 'kpi-value ' + cls;
    if (labelEl) { labelEl.textContent = label; labelEl.className = 'kpi-sub ' + cls; }

    // Ring canvas
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    const cx = 26, cy = 26, r = 20, lw = 5;
    const scoreColor = { 'score-excellent':'#00E676','score-good':'#69F0AE','score-ok':'#FFD600','score-bad':'#FF8A65','score-critical':'#FF3B3B' }[cls] || '#888';
    ctx2d.clearRect(0, 0, 52, 52);
    // Track
    ctx2d.beginPath(); ctx2d.arc(cx, cy, r, 0, Math.PI * 2);
    ctx2d.strokeStyle = 'rgba(255,255,255,0.08)'; ctx2d.lineWidth = lw; ctx2d.stroke();
    // Fill
    const angle = (score / 100) * Math.PI * 2 - Math.PI / 2;
    ctx2d.beginPath(); ctx2d.arc(cx, cy, r, -Math.PI / 2, angle);
    ctx2d.strokeStyle = scoreColor; ctx2d.lineWidth = lw;
    ctx2d.lineCap = 'round'; ctx2d.stroke();
  }

  // ===== MULTIPLE INSIGHTS =====
  function _renderInsights(pct, expenses, salary, totalInv) {
    const container = document.getElementById('insights-grid');
    if (!container) return;

    const cats = State.getCategories();
    const catSpend = {};
    expenses.forEach(e => { catSpend[e.catId] = (catSpend[e.catId] || 0) + e.value; });

    const msgs = [];

    // Primary insight
    if (salary === 0) {
      msgs.push({ icon: '⚙️', tag: 'Configuração', text: 'Configure seu salário nas <strong>Configurações</strong> para ativar o assistente inteligente.', color: 'var(--border)' });
    } else if (expenses.length === 0) {
      msgs.push({ icon: '📝', tag: 'Inteligência Axion', text: 'Nenhum gasto registrado este mês. Comece a registrar para receber insights.', color: 'var(--border)' });
    } else if (pct > 95) {
      msgs.push({ icon: '🚨', tag: 'Alerta Crítico', text: `Saldo <strong>crítico</strong>: você gastou ${pct.toFixed(1)}% do salário. Evite novos gastos até o próximo mês.`, color: 'var(--red)' });
    } else if (pct > 80) {
      msgs.push({ icon: '⚠️', tag: 'Atenção', text: `Você gastou <strong>${pct.toFixed(1)}%</strong> do salário. Controle os gastos restantes com cuidado.`, color: '#FFD600' });
    } else if (pct > 0) {
      msgs.push({ icon: '✅', tag: 'Inteligência Axion', text: `Bom controle! Você usou <strong>${pct.toFixed(1)}%</strong> do salário. Saldo: <strong>R$ ${(salary - expenses.reduce((s,e)=>s+e.value,0)).toLocaleString('pt-BR',{minimumFractionDigits:2})}</strong>.`, color: 'var(--green)' });
    }

    // Category limit alerts
    cats.forEach(c => {
      if (c.limit > 0 && salary > 0) {
        const s = catSpend[c.id] || 0;
        const catPct = s / salary * 100;
        if (catPct > c.limit) {
          msgs.push({ icon: '🔴', tag: `Limite — ${c.name}`, text: `Limite de <strong>${c.name}</strong> ultrapassado (${catPct.toFixed(1)}% vs ${c.limit}% permitido).`, color: '#FFD600' });
        }
      }
    });

    // Investment suggestion
    if (salary > 0 && expenses.length > 0) {
      const invPct = totalInv / salary * 100;
      if (invPct < 5) {
        msgs.push({ icon: '💡', tag: 'Sugestão de Investimento', text: `Você investiu apenas <strong>${invPct.toFixed(1)}%</strong> do salário este mês. Considere aportar pelo menos 10%.`, color: 'var(--green)' });
      }
    }

    container.innerHTML = msgs.map((m, idx) => `
      <div class="insight-card card" style="border-left-color:${m.color};animation-delay:${idx * 0.08}s">
        <div class="insight-icon">${m.icon}</div>
        <div class="insight-content">
          <div class="insight-tag">${m.tag}</div>
          <p class="insight-text">${m.text}</p>
        </div>
      </div>`).join('');
  }

  // ===== PROJECTION CARD =====
  function _renderProjection(salary, allExpenses) {
    const card = document.getElementById('proj-months');
    const badge = document.getElementById('proj-trend-badge');
    if (!card) return;

    if (salary === 0) {
      card.innerHTML = '<div style="padding:16px 20px;color:var(--text-3);font-size:0.85rem">Configure seu salário para ver projeções.</div>';
      return;
    }

    const now = new Date();
    const months = [];

    // Last 3 months for avg
    const last3 = [];
    for (let i = 3; i >= 1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth(), y = d.getFullYear();
      const t = allExpenses.filter(e => { const ed = new Date(e.date); return ed.getMonth()===m && ed.getFullYear()===y; }).reduce((s,e)=>s+e.value,0);
      last3.push(t);
    }
    // Current month daily rate
    const today = now.getDate();
    const daysInCurrent = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    const currentSpent = allExpenses.filter(e => { const d = new Date(e.date); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); }).reduce((s,e)=>s+e.value,0);
    const dailyRate = today > 0 ? currentSpent / today : 0;
    const avgLast3 = last3.reduce((s,v)=>s+v,0) / 3 || dailyRate * daysInCurrent;

    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const label = d.toLocaleString('pt-BR', { month: 'long' });
      const daysInMonth = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
      // Blend: 70% avg history + 30% current trend
      const projSpend = avgLast3 * 0.7 + (dailyRate * daysInMonth) * 0.3;
      const projBalance = salary - projSpend;
      months.push({ label, projSpend, projBalance, daysInMonth });
    }

    const maxSpend = Math.max(...months.map(m => m.projSpend), salary);
    card.innerHTML = months.map(m => {
      const fillPct = Math.min(100, m.projSpend / maxSpend * 100);
      const pos = m.projBalance >= 0;
      const fillColor = m.projBalance < 0 ? 'var(--red)' : m.projBalance < salary * 0.2 ? '#FFD600' : 'var(--green)';
      return `<div class="proj-month">
        <div class="proj-month-label">${m.label}</div>
        <div class="proj-month-balance ${pos ? 'positive' : 'negative'}">${_fmt(m.projBalance)}</div>
        <div class="proj-month-sub">Gasto est.: ${_fmt(m.projSpend)}</div>
        <div class="proj-month-bar"><div class="proj-month-bar-fill" style="width:${fillPct}%;background:${fillColor}"></div></div>
      </div>`;
    }).join('');

    // Trend badge
    if (badge) {
      const avgProj = months.reduce((s,m)=>s+m.projBalance,0)/3;
      if (avgProj >= salary * 0.3) { badge.textContent = '📈 Tendência positiva'; badge.className = 'proj-badge'; }
      else if (avgProj >= 0)       { badge.textContent = '⚠️ Atenção'; badge.className = 'proj-badge warn'; }
      else                         { badge.textContent = '🚨 Risco de déficit'; badge.className = 'proj-badge danger'; }
    }
  }

  function _renderDashDonut(expenses) {
    const cats = State.getCategories();
    const catSpend = {};
    expenses.forEach(e => { catSpend[e.catId] = (catSpend[e.catId] || 0) + e.value; });

    const labels = [];
    const values = [];
    const colors = [];

    cats.forEach(c => {
      const v = catSpend[c.id] || 0;
      if (v > 0) {
        labels.push(c.name);
        values.push(v);
        colors.push(c.color);
      }
    });

    const ctx = document.getElementById('dash-donut');
    if (!ctx) return;

    if (_dashDonut) { _dashDonut.destroy(); _dashDonut = null; }

    if (values.length === 0) {
      // Empty state
      const legend = document.getElementById('dash-legend');
      if (legend) legend.innerHTML = '<span style="color:var(--text-3);font-size:0.8rem">Sem dados</span>';
      return;
    }

    _dashDonut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${_fmt(ctx.parsed)}`
            }
          }
        }
      }
    });

    // Custom legend
    const legend = document.getElementById('dash-legend');
    if (legend) {
      legend.innerHTML = labels.map((l, i) =>
        `<div class="dash-legend-item">
          <span class="dash-legend-dot" style="background:${colors[i]}"></span>
          <span>${l}</span>
        </div>`
      ).join('');
    }
  }

  function _renderRecentList(expenses) {
    const list = document.getElementById('recent-list');
    if (!list) return;
    const recent = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
    if (recent.length === 0) {
      list.innerHTML = '<div class="empty-state-sm">Nenhuma transação registrada.</div>';
      return;
    }
    const cats = State.getCategories();
    list.innerHTML = recent.map(e => {
      const cat = cats.find(c => c.id === e.catId) || { name: e.catId, color: '#888' };
      return `<div class="tx-item">
        <div class="tx-left">
          <span class="tx-cat-dot" style="background:${cat.color}"></span>
          <div class="tx-info">
            <span class="tx-desc">${_esc(e.desc || cat.name)}</span>
            <span class="tx-meta">${cat.name} · ${_dateLabel(e.date)}</span>
          </div>
        </div>
        <span class="tx-value">-${_fmt(e.value)}</span>
      </div>`;
    }).join('');
  }

  // ===== CATEGORY LIST =====
  function renderCategoryList() {
    const list = document.getElementById('category-list');
    if (!list) return;
    const cats = State.getCategories();
    const salary = State.getSalary();
    const expenses = _filterByMonth(State.getExpenses());
    const catSpend = {};
    expenses.forEach(e => { catSpend[e.catId] = (catSpend[e.catId] || 0) + e.value; });

    if (cats.length === 0) {
      list.innerHTML = '<p style="color:var(--text-3);font-size:0.85rem;padding:16px 20px">Nenhuma categoria. Adicione uma.</p>';
      return;
    }

    list.innerHTML = cats.map(c => {
      const spent = catSpend[c.id] || 0;
      const limitVal = salary > 0 ? (c.limit / 100 * salary) : 0;
      const fillPct = limitVal > 0 ? Math.min(100, spent / limitVal * 100) : 0;
      const overLimit = limitVal > 0 && spent > limitVal;
      const fillColor = overLimit ? 'var(--red)' : c.color;
      return `<div class="cat-item">
        <span class="cat-dot" style="background:${c.color}"></span>
        <span class="cat-name">${_esc(c.name)}</span>
        <div class="cat-limit-bar">
          <div class="cat-bar-track">
            <div class="cat-bar-fill" style="width:${fillPct}%;background:${fillColor}"></div>
          </div>
          <span class="cat-limit-pct">${_fmt(spent)} / ${c.limit}% (${_fmt(limitVal)})</span>
        </div>
        <div class="cat-actions">
          <button class="cat-del-btn" onclick="Logic.deleteCategory('${c.id}')" title="Remover">✕</button>
        </div>
      </div>`;
    }).join('');

    // Update filter select
    _syncCategorySelects();
  }

  function _syncCategorySelects() {
    const cats = State.getCategories();
    const selects = ['filter-cat', 'expense-cat'];
    selects.forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const currentVal = sel.value;
      if (id === 'filter-cat') {
        sel.innerHTML = '<option value="all">Todas</option>' +
          cats.map(c => `<option value="${c.id}">${_esc(c.name)}</option>`).join('');
      } else {
        sel.innerHTML = cats.map(c => `<option value="${c.id}">${_esc(c.name)}</option>`).join('');
      }
      sel.value = currentVal;
    });
  }

  // ===== EXPENSES =====
  function renderExpenses() {
    const list = document.getElementById('expense-list');
    if (!list) return;

    let expenses = State.getExpenses();
    const cats = State.getCategories();

    // Filter
    const catFilter = document.getElementById('filter-cat')?.value || 'all';
    const period = document.getElementById('filter-period')?.value || 'month';
    const sort = document.getElementById('filter-sort')?.value || 'date-desc';

    if (catFilter !== 'all') expenses = expenses.filter(e => e.catId === catFilter);
    if (period === 'month') expenses = _filterByMonth(expenses);
    if (period === 'week') expenses = _filterByWeek(expenses);

    // Sort
    expenses = [...expenses].sort((a, b) => {
      if (sort === 'date-desc') return new Date(b.date) - new Date(a.date);
      if (sort === 'date-asc') return new Date(a.date) - new Date(b.date);
      if (sort === 'value-desc') return b.value - a.value;
      if (sort === 'value-asc') return a.value - b.value;
      return 0;
    });

    if (expenses.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <span class="empty-icon">◎</span>
        <p>Nenhum gasto encontrado.</p>
        <button class="btn-ghost btn-sm" onclick="UI.openExpenseModal()">Adicionar gasto</button>
      </div>`;
      return;
    }

    list.innerHTML = expenses.map(e => {
      const cat = cats.find(c => c.id === e.catId) || { name: e.catId, color: '#888' };
      return `<div class="expense-item">
        <span class="exp-dot" style="background:${cat.color}"></span>
        <div class="exp-info">
          <span class="exp-desc">${_esc(e.desc || cat.name)}</span>
          <span class="exp-meta">${_dateLabel(e.date)}</span>
        </div>
        <span class="exp-cat-badge">${_esc(cat.name)}</span>
        <span class="exp-value">-${_fmt(e.value)}</span>
        <button class="exp-del-btn" onclick="Logic.deleteExpense('${e.id}')" title="Excluir">✕</button>
      </div>`;
    }).join('');
  }

  // ===== CHARTS =====
  function renderCharts() {
    const period = document.getElementById('chart-period')?.value || 'month';
    let expenses = State.getExpenses();
    if (period === 'month') expenses = _filterByMonth(expenses);

    const cats = State.getCategories();
    const salary = State.getSalary();

    _renderBarChart(expenses, cats, salary);
    _renderPieChart(expenses, cats);
    _renderLineChart();
    _renderCatBreakdown(expenses, cats, salary);
  }

  function _renderBarChart(expenses, cats, salary) {
    const catSpend = {};
    expenses.forEach(e => { catSpend[e.catId] = (catSpend[e.catId] || 0) + e.value; });

    const labels = cats.map(c => c.name);
    const spent = cats.map(c => catSpend[c.id] || 0);
    const limits = cats.map(c => salary * c.limit / 100);
    const colors = cats.map(c => c.color);

    const ctx = document.getElementById('chart-bar');
    if (!ctx) return;
    if (_chartBar) { _chartBar.destroy(); }

    _chartBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Gasto',
            data: spent,
            backgroundColor: colors.map(c => c + 'CC'),
            borderColor: colors,
            borderWidth: 1,
            borderRadius: 6,
          },
          {
            label: 'Limite',
            data: limits,
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderColor: 'rgba(255,255,255,0.2)',
            borderWidth: 1,
            borderRadius: 6,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { labels: { color: '#A0A0A0', font: { size: 11 } } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${_fmt(ctx.parsed.y)}` } }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#A0A0A0' } },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#A0A0A0', callback: v => 'R$ ' + v.toLocaleString('pt-BR') }
          }
        }
      }
    });
  }

  function _renderPieChart(expenses, cats) {
    const catSpend = {};
    expenses.forEach(e => { catSpend[e.catId] = (catSpend[e.catId] || 0) + e.value; });
    const data = cats.map(c => catSpend[c.id] || 0).filter((v, i) => v > 0);
    const labels = cats.filter(c => (catSpend[c.id] || 0) > 0).map(c => c.name);
    const colors = cats.filter(c => (catSpend[c.id] || 0) > 0).map(c => c.color);

    const ctx = document.getElementById('chart-pie');
    if (!ctx) return;
    if (_chartPie) { _chartPie.destroy(); }

    _chartPie = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }] },
      options: {
        responsive: true, maintainAspectRatio: true,
        cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#A0A0A0', padding: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${_fmt(ctx.parsed)}` } }
        }
      }
    });
  }

  function _renderLineChart() {
    const allExpenses = State.getExpenses();
    const months = [];
    const totals = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
      months.push(label);
      const m = d.getMonth(), y = d.getFullYear();
      const total = allExpenses
        .filter(e => { const ed = new Date(e.date); return ed.getMonth() === m && ed.getFullYear() === y; })
        .reduce((s, e) => s + e.value, 0);
      totals.push(total);
    }

    const ctx = document.getElementById('chart-line');
    if (!ctx) return;
    if (_chartLine) { _chartLine.destroy(); }

    _chartLine = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          label: 'Total Gasto',
          data: totals,
          borderColor: '#FF3B3B',
          backgroundColor: 'rgba(255,59,59,0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#FF3B3B',
          pointBorderColor: '#FF3B3B',
          pointRadius: 5,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: {
          legend: { labels: { color: '#A0A0A0', font: { size: 11 } } },
          tooltip: { callbacks: { label: ctx => ` Gasto: ${_fmt(ctx.parsed.y)}` } }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#A0A0A0' } },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#A0A0A0', callback: v => 'R$' + v.toLocaleString('pt-BR') }
          }
        }
      }
    });
  }

  function _renderCatBreakdown(expenses, cats, salary) {
    const catSpend = {};
    expenses.forEach(e => { catSpend[e.catId] = (catSpend[e.catId] || 0) + e.value; });
    const total = Object.values(catSpend).reduce((s, v) => s + v, 0);

    const container = document.getElementById('cat-breakdown');
    if (!container) return;

    const sorted = [...cats].sort((a, b) => (catSpend[b.id] || 0) - (catSpend[a.id] || 0));
    container.innerHTML = sorted.map(c => {
      const v = catSpend[c.id] || 0;
      const pct = total > 0 ? (v / total * 100) : 0;
      const salPct = salary > 0 ? (v / salary * 100) : 0;
      const over = c.limit > 0 && salPct > c.limit;
      return `<div class="breakdown-item">
        <span class="bk-dot" style="background:${c.color}"></span>
        <span class="bk-name">${_esc(c.name)}</span>
        <div class="bk-bar-wrap">
          <div class="bk-bar">
            <div class="bk-bar-fill" style="width:${pct}%;background:${over ? 'var(--red)' : c.color}"></div>
          </div>
          <span class="bk-val">${_fmt(v)}</span>
          <span class="bk-pct">${pct.toFixed(1)}%</span>
        </div>
      </div>`;
    }).join('');
  }

  // ===== INVESTMENTS =====
  function renderInvestments() {
    const d = State.get();
    const salary = State.getSalary();
    const expenses = _filterByMonth(State.getExpenses());
    const total = expenses.reduce((s, e) => s + e.value, 0);
    const balance = salary - total;

    // Insight
    const insightEl = document.getElementById('invest-insight-text');
    if (insightEl) {
      if (salary === 0) {
        insightEl.textContent = 'Configure seu salário para receber sugestões personalizadas.';
      } else if (balance <= 0) {
        insightEl.innerHTML = 'Seu saldo disponível está em zero. Revise seus gastos antes de investir.';
      } else {
        const sugestPct = d.investorProfile === 'conservador' ? 10 : d.investorProfile === 'moderado' ? 20 : 30;
        const sugest = balance * sugestPct / 100;
        insightEl.innerHTML = `Com saldo de <strong>${_fmt(balance)}</strong>, você poderia investir <strong>${_fmt(sugest)}</strong> (${sugestPct}% do disponível) conforme seu perfil <em>${d.investorProfile}</em>.`;
      }
    }

    // Profile display
    const pd = document.getElementById('profile-display');
    if (pd) {
      const p = _profileData(d.investorProfile);
      pd.innerHTML = `<div class="profile-display-inner">
        <span class="profile-display-emoji">${p.emoji}</span>
        <div class="profile-display-info">
          <h4>${p.label}</h4>
          <p>${p.desc}</p>
        </div>
      </div>`;
    }

    // Recommendations
    const rec = document.getElementById('invest-recommendations');
    if (rec) {
      const recs = _getRecommendations(d.investorProfile);
      rec.innerHTML = recs.map(r =>
        `<div class="rec-card">
          <div class="rec-card-header">
            <span class="rec-icon">${r.icon}</span>
            <div>
              <div class="rec-name">${r.name}</div>
              <div class="rec-pct">${r.returns}</div>
            </div>
          </div>
          <p class="rec-desc">${r.desc}</p>
          <span class="rec-allocation">${r.allocation}</span>
        </div>`
      ).join('');
    }
  }

  // ===== GOALS =====
  function renderGoals() {
    const grid = document.getElementById('goals-grid');
    if (!grid) return;
    const goals = State.getGoals();

    if (goals.length === 0) {
      grid.innerHTML = `<div class="empty-state">
        <span class="empty-icon">◆</span>
        <p>Nenhuma meta criada ainda.</p>
        <button class="btn-ghost btn-sm" onclick="UI.openGoalModal()">Criar primeira meta</button>
      </div>`;
      return;
    }

    grid.innerHTML = goals.map(g => {
      const pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
      const completed = pct >= 100;
      const remaining = g.target - g.current;
      const monthlyNeeded = g.deadline > 0 ? remaining / g.deadline : 0;
      return `<div class="goal-card">
        <div class="goal-header">
          <span class="goal-name">${_esc(g.name)}</span>
          <button class="goal-del" onclick="Logic.deleteGoal('${g.id}')">✕</button>
        </div>
        <div class="goal-amounts">
          <span class="goal-current">${_fmt(g.current)}</span>
          <span class="goal-target">de ${_fmt(g.target)}</span>
        </div>
        <div class="goal-progress-track">
          <div class="goal-progress-fill ${completed ? 'completed' : ''}" style="width:${pct}%"></div>
        </div>
        <span class="goal-pct">${pct.toFixed(1)}% ${completed ? '✓ Concluído!' : `· faltam ${_fmt(remaining)}`}</span>
        ${g.deadline > 0 ? `<div class="goal-deadline">Prazo: ${g.deadline} meses · Poupar ${_fmt(monthlyNeeded)}/mês</div>` : ''}
        ${!completed ? `
        <div class="goal-add-row">
          <input type="number" class="goal-add-input" id="goal-add-${g.id}" placeholder="Adicionar valor" min="0" />
          <button class="btn-ghost btn-sm" onclick="Logic.addToGoal('${g.id}')">+</button>
        </div>` : ''}
      </div>`;
    }).join('');
  }

  // ===== MODALS =====
  function openExpenseModal() {
    _syncCategorySelects();
    document.getElementById('expense-value').value = '';
    document.getElementById('expense-desc').value = '';
    document.getElementById('expense-date').value = _today();
    document.getElementById('expense-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('expense-value').focus(), 50);
  }
  function closeExpenseModal() {
    document.getElementById('expense-modal').classList.add('hidden');
  }
  function openGoalModal() {
    document.getElementById('goal-name').value = '';
    document.getElementById('goal-target').value = '';
    document.getElementById('goal-current').value = '0';
    document.getElementById('goal-deadline').value = '';
    document.getElementById('goal-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('goal-name').focus(), 50);
  }
  function closeGoalModal() {
    document.getElementById('goal-modal').classList.add('hidden');
  }

  // ===== INVESTMENT MODAL =====
  function openInvestmentModal() {
    document.getElementById('inv-asset').value = '';
    document.getElementById('inv-value').value = '';
    document.getElementById('inv-qty').value = '';
    document.getElementById('inv-notes').value = '';
    document.getElementById('inv-date').value = _today();
    document.getElementById('investment-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('inv-asset').focus(), 50);
  }
  function closeInvestmentModal() {
    document.getElementById('investment-modal').classList.add('hidden');
  }

  // ===== SETTINGS DRAWER =====
  function openSettingsDrawer() {
    const d = State.get();
    const dSalary = document.getElementById('drawer-salary');
    if (dSalary) dSalary.value = d.salary || '';
    const dTheme = document.getElementById('drawer-theme-toggle');
    if (dTheme) dTheme.checked = (d.settings.theme !== 'light');
    const dAlert = document.getElementById('drawer-alert-limit');
    if (dAlert) dAlert.checked = d.settings.alertLimit !== false;
    document.getElementById('settings-drawer').classList.remove('hidden');
    document.getElementById('settings-drawer-overlay').classList.remove('hidden');
  }
  function closeSettingsDrawer() {
    document.getElementById('settings-drawer').classList.add('hidden');
    document.getElementById('settings-drawer-overlay').classList.add('hidden');
  }

  // ===== TABS: Gastos page =====
  function switchGastosTab(tab) {
    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    // Tab contents
    const despesas = document.getElementById('tab-despesas');
    const portfolio = document.getElementById('tab-portfolio');
    if (tab === 'despesas') {
      despesas.classList.add('active-tab');   despesas.classList.remove('hidden-tab');
      portfolio.classList.remove('active-tab'); portfolio.classList.add('hidden-tab');
      // update add button
      const btn = document.getElementById('gastos-add-btn');
      if (btn) { btn.textContent = '+ Novo Gasto'; btn.onclick = () => openExpenseModal(); }
    } else {
      portfolio.classList.add('active-tab');  portfolio.classList.remove('hidden-tab');
      despesas.classList.remove('active-tab'); despesas.classList.add('hidden-tab');
      const btn = document.getElementById('gastos-add-btn');
      if (btn) { btn.textContent = '+ Novo Aporte'; btn.onclick = () => openInvestmentModal(); }
      renderPortfolio();
    }
  }

  // ===== PORTFOLIO RENDER =====
  function renderPortfolio() {
    let investments = State.getInvestments();

    // KPIs
    const allTotal = investments.reduce((s, i) => s + i.value, 0);
    const monthInv = _filterByMonthArr(investments);
    const monthTotal = monthInv.reduce((s, i) => s + i.value, 0);
    const uniqueAssets = new Set(investments.map(i => i.asset.toLowerCase())).size;

    _setText('port-total', _fmt(allTotal));
    _setText('port-month', _fmt(monthTotal));
    _setText('port-month-count', `${monthInv.length} operaç${monthInv.length === 1 ? 'ão' : 'ões'}`);
    _setText('port-assets', String(uniqueAssets));

    // Filters
    const typeFilter = document.getElementById('port-filter-type')?.value || 'all';
    const period = document.getElementById('port-filter-period')?.value || 'month';
    const sort = document.getElementById('port-filter-sort')?.value || 'date-desc';

    let filtered = [...investments];
    if (typeFilter !== 'all') filtered = filtered.filter(i => i.type === typeFilter);
    if (period === 'month') filtered = _filterByMonthArr(filtered);
    if (period === 'week') {
      const weekAgo = new Date(Date.now() - 7*24*60*60*1000);
      filtered = filtered.filter(i => new Date(i.date) >= weekAgo);
    }
    filtered.sort((a, b) => {
      if (sort === 'date-desc') return new Date(b.date) - new Date(a.date);
      if (sort === 'value-desc') return b.value - a.value;
      if (sort === 'value-asc') return a.value - b.value;
      return 0;
    });

    // Type breakdown
    _renderPortBreakdown(investments);

    // List
    const list = document.getElementById('portfolio-list');
    if (!list) return;

    if (filtered.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <span class="empty-icon">◇</span>
        <p>Nenhum aporte encontrado.</p>
        <button class="btn-ghost btn-sm" onclick="UI.openInvestmentModal()">Registrar aporte</button>
      </div>`;
      return;
    }

    const typeLabels = { cripto:'Cripto', acoes:'Ações', fii:'FII', etf:'ETF', 'renda-fixa':'Renda Fixa', outro:'Outro' };
    const typeIcons  = { cripto:'₿', acoes:'📈', fii:'🏡', etf:'📊', 'renda-fixa':'🔒', outro:'◇' };

    list.innerHTML = filtered.map(inv => `
      <div class="expense-item">
        <span class="exp-dot" style="background:${_typeColor(inv.type)}"></span>
        <div class="exp-info">
          <span class="exp-desc">${typeIcons[inv.type] || '◇'} ${_esc(inv.asset)}</span>
          <span class="exp-meta">${_dateLabel(inv.date)}${inv.qty ? ` · ${inv.qty} un.` : ''}${inv.notes ? ` · ${_esc(inv.notes)}` : ''}</span>
        </div>
        <span class="inv-type-badge inv-type-${inv.type}">${typeLabels[inv.type] || inv.type}</span>
        <span class="inv-value">+${_fmt(inv.value)}</span>
        <button class="exp-del-btn" onclick="Logic.deleteInvestment('${inv.id}')" title="Excluir">✕</button>
      </div>`
    ).join('');
  }

  function _renderPortBreakdown(investments) {
    const bd = document.getElementById('port-breakdown');
    if (!bd) return;
    if (investments.length === 0) { bd.innerHTML = '<p style="color:var(--text-3);font-size:0.85rem">Nenhum dado.</p>'; return; }

    const totByType = {};
    investments.forEach(i => { totByType[i.type] = (totByType[i.type] || 0) + i.value; });
    const grand = Object.values(totByType).reduce((s,v) => s+v, 0);
    const typeLabels = { cripto:'Cripto', acoes:'Ações', fii:'FII', etf:'ETF', 'renda-fixa':'Renda Fixa', outro:'Outro' };

    bd.innerHTML = Object.entries(totByType)
      .sort((a,b) => b[1]-a[1])
      .map(([type, val]) => {
        const pct = grand > 0 ? (val/grand*100) : 0;
        const color = _typeColor(type);
        return `<div class="breakdown-item">
          <span class="bk-dot" style="background:${color}"></span>
          <span class="bk-name">${typeLabels[type]||type}</span>
          <div class="bk-bar-wrap">
            <div class="bk-bar"><div class="bk-bar-fill" style="width:${pct}%;background:${color}"></div></div>
            <span class="bk-val">${_fmt(val)}</span>
            <span class="bk-pct">${pct.toFixed(1)}%</span>
          </div>
        </div>`;
      }).join('');
  }

  function _typeColor(type) {
    return { cripto:'#FFD54F', acoes:'#4FC3F7', fii:'#A5D6A7', etf:'#CE93D8', 'renda-fixa':'#00E676', outro:'#B0BEC5' }[type] || '#888';
  }

  function showConfirm(title, text, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-text').textContent = text;
    const btn = document.getElementById('confirm-ok-btn');
    btn.onclick = () => { UI.closeConfirm(); onConfirm(); };
    document.getElementById('confirm-modal').classList.remove('hidden');
  }
  function closeConfirm() {
    document.getElementById('confirm-modal').classList.add('hidden');
  }

  // ===== LEARN =====
  const LEARN_CONTENT = {
    cdb: {
      title: '🏦 CDB — Certificado de Depósito Bancário',
      body: `
        <p>O CDB é um título de renda fixa emitido por bancos para captar recursos. Ao investir em um CDB, você <strong>empresta dinheiro ao banco</strong> e recebe juros em troca.</p>
        <h4>Como funciona</h4>
        <p>O banco utiliza esse dinheiro para financiar suas operações. Em troca, paga uma taxa de rendimento que pode ser:</p>
        <ul>
          <li><strong>Prefixada:</strong> taxa definida no momento da aplicação (ex: 12% ao ano)</li>
          <li><strong>Pós-fixada:</strong> atrelada ao CDI (ex: 100% do CDI)</li>
          <li><strong>Híbrida:</strong> parte fixa + parte atrelada à inflação (ex: IPCA + 5%)</li>
        </ul>
        <h4>Vantagens</h4>
        <ul>
          <li>Protegido pelo FGC até R$ 250.000 por instituição</li>
          <li>Pode superar a poupança significativamente</li>
          <li>Disponível em diversas corretoras sem custo</li>
        </ul>
        <div class="learn-highlight">💡 Para iniciantes: CDBs de bancos digitais costumam oferecer 100-120% do CDI, muito superior à poupança (~70% do CDI).</div>
        <h4>Tributação</h4>
        <p>Segue tabela regressiva de IR: 22,5% (até 180 dias), 20% (181–360 dias), 17,5% (361–720 dias), 15% (acima de 720 dias).</p>
        <div class="learn-warning">⚠️ Verifique o prazo de liquidez antes de investir. Alguns CDBs só permitem resgate no vencimento.</div>
      `
    },
    cdi: {
      title: '📊 CDI — Certificado de Depósito Interbancário',
      body: `
        <p>O CDI é a taxa que os bancos usam para emprestar dinheiro entre si. Ele serve como <strong>referência para a maioria dos investimentos de renda fixa</strong> no Brasil.</p>
        <h4>Por que o CDI importa?</h4>
        <p>Quando você vê um investimento rendendo "100% do CDI", significa que ele acompanha exatamente essa taxa. O CDI fica muito próximo da taxa Selic (taxa básica de juros).</p>
        <div class="learn-highlight">💡 CDI atual: próximo à taxa Selic. Acompanhe em <strong>bcb.gov.br</strong>.</div>
        <h4>Como usar como comparação</h4>
        <ul>
          <li>Poupança: ~70% do CDI (ruim)</li>
          <li>CDB banco grande: 85-100% do CDI (regular)</li>
          <li>CDB banco digital: 100-120% do CDI (bom)</li>
          <li>LCI/LCA: 85-100% do CDI + isento de IR (ótimo)</li>
        </ul>
        <p>Sempre compare investimentos em relação ao CDI para saber qual rende mais.</p>
      `
    },
    'renda-fixa': {
      title: '🔒 Renda Fixa — Previsibilidade e Segurança',
      body: `
        <p>Renda fixa é a categoria de investimentos onde as <strong>regras de rendimento são definidas antes</strong> de você investir. Você sabe (ou consegue estimar) quanto vai receber.</p>
        <h4>Principais tipos</h4>
        <ul>
          <li><strong>Tesouro Direto:</strong> títulos do governo, a partir de R$ 30</li>
          <li><strong>CDB:</strong> certificados de depósito bancário</li>
          <li><strong>LCI/LCA:</strong> letras de crédito imobiliário/agronegócio (isentos de IR)</li>
          <li><strong>Debêntures:</strong> dívida de empresas privadas</li>
          <li><strong>Fundos de renda fixa:</strong> carteiras gerenciadas</li>
        </ul>
        <h4>Para quem é ideal?</h4>
        <div class="learn-highlight">✅ Ideal para: reserva de emergência, objetivos de curto/médio prazo, perfil conservador e parcela defensiva de qualquer carteira.</div>
        <h4>Riscos</h4>
        <ul>
          <li>Risco de crédito: emitente pode não pagar (protegido pelo FGC em bancos)</li>
          <li>Risco de mercado: mark-to-market pode gerar perdas se resgatar antes do prazo</li>
          <li>Risco de inflação: retorno real pode ser baixo se inflação subir</li>
        </ul>
      `
    },
    'renda-variavel': {
      title: '📈 Renda Variável — Crescimento com Risco',
      body: `
        <p>Renda variável são investimentos onde <strong>não há garantia de retorno</strong>. Os valores oscilam conforme o mercado — para cima e para baixo.</p>
        <h4>Principais tipos</h4>
        <ul>
          <li><strong>Ações:</strong> participação em empresas listadas na B3</li>
          <li><strong>FIIs (Fundos Imobiliários):</strong> cotas de empreendimentos imobiliários</li>
          <li><strong>ETFs:</strong> fundos que replicam índices (ex: BOVA11 replica o Ibovespa)</li>
          <li><strong>BDRs:</strong> recibos de ações de empresas estrangeiras</li>
          <li><strong>Fundos de ações:</strong> carteiras gerenciadas por gestores</li>
        </ul>
        <div class="learn-highlight">💡 Regra de ouro: invista em renda variável apenas o dinheiro que não precisará no curto prazo (mínimo 3-5 anos).</div>
        <h4>Estratégias para iniciantes</h4>
        <ul>
          <li>Comece com ETFs amplos (diversificação imediata)</li>
          <li>Invista mensalmente (estratégia DCA)</li>
          <li>Não tente "acertar o timing" do mercado</li>
          <li>Mantenha sempre uma reserva de emergência em renda fixa</li>
        </ul>
        <div class="learn-warning">⚠️ Cuidado com dicas de "ações quentes". Estude antes de comprar papéis individuais.</div>
      `
    },
    cripto: {
      title: '₿ Criptomoedas — Alta Volatilidade, Alto Potencial',
      body: `
        <p>Criptomoedas são <strong>ativos digitais descentralizados</strong> baseados em tecnologia blockchain. Bitcoin e Ethereum são as mais conhecidas.</p>
        <h4>Características</h4>
        <ul>
          <li>Extremamente voláteis: podem valorizar ou desvalorizar 30-80% em semanas</li>
          <li>Sem regulação central (risco e liberdade ao mesmo tempo)</li>
          <li>Mercado 24/7, sem feriados</li>
          <li>Custodia sob responsabilidade do próprio investidor (ou exchange)</li>
        </ul>
        <div class="learn-warning">⚠️ Invista apenas o que está disposto a perder 100%. Criptomoedas não são indicadas para reserva de emergência.</div>
        <h4>Como começar com segurança</h4>
        <ul>
          <li>Use exchanges regulamentadas (Binance, Mercado Bitcoin, Coinbase)</li>
          <li>Comece com Bitcoin e Ethereum (mais consolidadas)</li>
          <li>Limite criptos a no máximo 5-10% da carteira</li>
          <li>Pesquise antes de qualquer altcoin ou projeto novo</li>
        </ul>
        <div class="learn-highlight">💡 DCA (Dollar Cost Average): investir um valor fixo mensalmente reduz o risco de comprar na máxima.</div>
      `
    },
    tesouro: {
      title: '🏛️ Tesouro Direto — O Investimento Mais Seguro do Brasil',
      body: `
        <p>O Tesouro Direto é um programa do governo federal que permite que <strong>pessoas físicas invistam em títulos públicos</strong> pela internet, a partir de R$ 30.</p>
        <h4>Tipos de títulos</h4>
        <ul>
          <li><strong>Tesouro Selic:</strong> segue a taxa Selic, ideal para reserva de emergência</li>
          <li><strong>Tesouro Prefixado:</strong> taxa definida no momento da compra (ex: 12% ao ano)</li>
          <li><strong>Tesouro IPCA+:</strong> protege da inflação + taxa real extra</li>
        </ul>
        <h4>Vantagens</h4>
        <ul>
          <li>O título mais seguro do Brasil (risco soberano)</li>
          <li>Acessível: a partir de R$ 30</li>
          <li>Liquidez diária (Tesouro Selic)</li>
          <li>Disponível em qualquer corretora habilitada</li>
        </ul>
        <div class="learn-highlight">✅ Recomendação: Tesouro Selic para reserva de emergência. Tesouro IPCA+ para objetivos de longo prazo (aposentadoria).</div>
        <h4>Tributação</h4>
        <p>Segue a mesma tabela regressiva do IR que o CDB. Há também cobrança de IOF para resgates em menos de 30 dias.</p>
      `
    }
  };

  function openLearnDetail(topic) {
    const content = LEARN_CONTENT[topic];
    if (!content) return;
    document.getElementById('learn-detail-title').textContent = content.title;
    document.getElementById('learn-detail-body').innerHTML = content.body;
    document.getElementById('learn-detail').classList.remove('hidden');
    document.getElementById('learn-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function closeLearnDetail() {
    document.getElementById('learn-detail').classList.add('hidden');
  }

  function toggleAddCategory() {
    const form = document.getElementById('add-category-form');
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
      document.getElementById('new-cat-name').focus();
    }
  }

  // ===== TOAST =====
  function toast(msg, type = 'default') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `toast toast-${type}`;
    el.classList.remove('hidden');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.add('hidden'), 2800);
  }

  // ===== HELPERS =====
  function _fmt(v) {
    return 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  function _esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _today() {
    return new Date().toISOString().split('T')[0];
  }
  function _filterByMonth(expenses) {
    const now = new Date();
    return expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }
  function _filterByWeek(expenses) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return expenses.filter(e => new Date(e.date) >= weekAgo);
  }
  function _filterByMonthArr(arr) {
    const now = new Date();
    return arr.filter(i => {
      const d = new Date(i.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }
  function _dateLabel(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Ontem';
    if (diff < 7) return `Há ${diff} dias`;
    return d.toLocaleDateString('pt-BR');
  }
  function _profileLabel(p) {
    return { conservador: 'Perfil Conservador', moderado: 'Perfil Moderado', arrojado: 'Perfil Arrojado' }[p] || 'Perfil Moderado';
  }
  function _profileData(p) {
    return {
      conservador: { emoji: '🛡️', label: 'Conservador', desc: 'Prioriza segurança e previsibilidade. Foco em renda fixa de baixo risco.' },
      moderado:    { emoji: '⚖️', label: 'Moderado', desc: 'Equilíbrio entre segurança e crescimento. Combina renda fixa e variável.' },
      arrojado:    { emoji: '🚀', label: 'Arrojado', desc: 'Busca máximo retorno a longo prazo. Aceita maior volatilidade.' },
    }[p] || {};
  }
  function _getRecommendations(profile) {
    const recs = {
      conservador: [
        { icon: '🏛️', name: 'Tesouro Selic', returns: '100% Selic', desc: 'Liquidez diária e máxima segurança. Ideal para reserva de emergência.', allocation: '50% da carteira' },
        { icon: '🏦', name: 'CDB 100%+ CDI', returns: '100–110% CDI', desc: 'Bancos digitais oferecem ótimas taxas com proteção FGC até R$250k.', allocation: '30% da carteira' },
        { icon: '🏡', name: 'LCI / LCA', returns: '85–95% CDI', desc: 'Isento de imposto de renda. Retorno líquido competitivo.', allocation: '20% da carteira' },
      ],
      moderado: [
        { icon: '🏛️', name: 'Tesouro IPCA+', returns: 'IPCA + 5-6%', desc: 'Protege do aumento da inflação e garante retorno real positivo.', allocation: '30% da carteira' },
        { icon: '🏦', name: 'CDB / LCI / LCA', returns: '100–115% CDI', desc: 'Base sólida e previsível da carteira.', allocation: '30% da carteira' },
        { icon: '📊', name: 'FIIs (IFIX)', returns: '8–12% a.a.', desc: 'Dividendos mensais isentos de IR. Exposição ao mercado imobiliário.', allocation: '25% da carteira' },
        { icon: '📈', name: 'ETF BOVA11', returns: 'Ibovespa', desc: 'Diversificação no mercado de ações com baixo custo.', allocation: '15% da carteira' },
      ],
      arrojado: [
        { icon: '📈', name: 'Ações (B3)', returns: '10–20%+ a.a.', desc: 'Empresas sólidas de crescimento. Horizonte mínimo de 5 anos.', allocation: '40% da carteira' },
        { icon: '🌎', name: 'ETFs Internacionais', returns: 'S&P500 histórico', desc: 'Exposição ao mercado americano e global.', allocation: '20% da carteira' },
        { icon: '🏡', name: 'FIIs', returns: '8–12% a.a.', desc: 'Renda passiva mensal com exposição imobiliária.', allocation: '20% da carteira' },
        { icon: '₿', name: 'Criptomoedas', returns: 'Alta volatilidade', desc: 'Bitcoin e Ethereum para quem aceita alta volatilidade.', allocation: '10% da carteira' },
        { icon: '🏛️', name: 'Renda Fixa', returns: '100%+ CDI', desc: 'Reserva mínima de segurança.', allocation: '10% da carteira' },
      ]
    };
    return recs[profile] || recs.moderado;
  }

  function _updateGreeting() {
    const h = new Date().getHours();
    const d = State.get();
    const part = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const name = d.userName && d.userName !== 'Usuário' ? `, ${d.userName}` : '';
    const el = document.getElementById('dash-greeting');
    if (el) el.textContent = `${part}${name} — veja seu resumo financeiro`;
  }

  return {
    init, navigateTo, renderDashboard, renderCategoryList, renderExpenses,
    renderCharts, renderGoals, renderInvestments, renderPortfolio,
    openExpenseModal, closeExpenseModal, openGoalModal, closeGoalModal,
    openInvestmentModal, closeInvestmentModal,
    openSettingsDrawer, closeSettingsDrawer,
    switchGastosTab,
    showConfirm, closeConfirm,
    openLearnDetail, closeLearnDetail,
    toggleAddCategory, toast,
  };
})();


/* ============================================================
   MODULE: LOGIC — Operações e inteligência
   ============================================================ */
const Logic = (() => {

  // ===== EXPENSE =====
  function addExpense() {
    const val = parseFloat(document.getElementById('expense-value').value);
    const desc = document.getElementById('expense-desc').value.trim();
    const catId = document.getElementById('expense-cat').value;
    const date = document.getElementById('expense-date').value;

    if (!val || val <= 0) { UI.toast('Informe um valor válido', 'error'); return; }
    if (!catId) { UI.toast('Selecione uma categoria', 'error'); return; }
    if (!date) { UI.toast('Selecione uma data', 'error'); return; }

    const d = State.get();
    d.expenses.push({
      id: _uid(),
      value: val,
      desc: desc || '',
      catId,
      date,
    });
    State.save();
    UI.closeExpenseModal();
    UI.renderDashboard();
    UI.renderExpenses();
    UI.renderCategoryList();
    UI.toast(`Gasto de R$ ${val.toFixed(2)} adicionado`, 'success');

    // Check limit alert
    _checkLimitAlert(catId, val);
  }

  function _checkLimitAlert(catId, val) {
    const d = State.get();
    if (!d.settings.alertLimit) return;
    const cat = d.categories.find(c => c.id === catId);
    if (!cat || !cat.limit || !d.salary) return;
    const monthly = _filterByMonth(d.expenses).filter(e => e.catId === catId).reduce((s, e) => s + e.value, 0);
    const limit = d.salary * cat.limit / 100;
    if (monthly > limit) {
      UI.toast(`⚠️ Limite de ${cat.name} ultrapassado!`, 'error');
    }
  }

  function deleteExpense(id) {
    const d = State.get();
    d.expenses = d.expenses.filter(e => e.id !== id);
    State.save();
    UI.renderExpenses();
    UI.renderDashboard();
    UI.renderCategoryList();
    UI.toast('Gasto removido');
  }

  // ===== CATEGORY =====
  function addCategory() {
    const name = document.getElementById('new-cat-name').value.trim();
    const limit = parseInt(document.getElementById('new-cat-limit').value) || 0;

    if (!name) { UI.toast('Informe um nome', 'error'); return; }

    const d = State.get();
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (d.categories.find(c => c.id === id)) { UI.toast('Categoria já existe', 'error'); return; }

    d.categories.push({
      id,
      name,
      color: _randomColor(),
      limit: Math.min(100, limit),
    });
    State.save();
    document.getElementById('new-cat-name').value = '';
    document.getElementById('new-cat-limit').value = '';
    document.getElementById('add-category-form').classList.add('hidden');
    UI.renderCategoryList();
    UI.toast(`Categoria "${name}" criada`, 'success');
  }

  function deleteCategory(id) {
    UI.showConfirm(
      'Remover categoria?',
      'Os gastos associados a esta categoria serão mantidos.',
      () => {
        const d = State.get();
        d.categories = d.categories.filter(c => c.id !== id);
        State.save();
        UI.renderCategoryList();
        UI.renderDashboard();
        UI.toast('Categoria removida');
      }
    );
  }

  // ===== GOALS =====
  function addGoal() {
    const name = document.getElementById('goal-name').value.trim();
    const target = parseFloat(document.getElementById('goal-target').value);
    const current = parseFloat(document.getElementById('goal-current').value) || 0;
    const deadline = parseInt(document.getElementById('goal-deadline').value) || 0;

    if (!name) { UI.toast('Informe um nome para a meta', 'error'); return; }
    if (!target || target <= 0) { UI.toast('Informe um valor alvo válido', 'error'); return; }

    const d = State.get();
    d.goals.push({ id: _uid(), name, target, current, deadline });
    State.save();
    UI.closeGoalModal();
    UI.renderGoals();
    UI.toast(`Meta "${name}" criada!`, 'success');
  }

  function deleteGoal(id) {
    UI.showConfirm('Excluir meta?', 'Esta ação não pode ser desfeita.', () => {
      const d = State.get();
      d.goals = d.goals.filter(g => g.id !== id);
      State.save();
      UI.renderGoals();
      UI.toast('Meta removida');
    });
  }

  function addToGoal(id) {
    const input = document.getElementById(`goal-add-${id}`);
    if (!input) return;
    const val = parseFloat(input.value);
    if (!val || val <= 0) { UI.toast('Informe um valor válido', 'error'); return; }
    const d = State.get();
    const goal = d.goals.find(g => g.id === id);
    if (!goal) return;
    goal.current = Math.min(goal.target, goal.current + val);
    State.save();
    UI.renderGoals();
    if (goal.current >= goal.target) {
      UI.toast(`🎉 Meta "${goal.name}" concluída!`, 'success');
    } else {
      UI.toast(`+${_fmtVal(val)} adicionados à meta`, 'success');
    }
  }

  // ===== INVESTMENTS =====
  function updateProfile(value) {
    const d = State.get();
    d.investorProfile = value;
    State.save();
    UI.renderInvestments();
    const sType = document.getElementById('sidebar-profile-type');
    if (sType) sType.textContent = { conservador: 'Perfil Conservador', moderado: 'Perfil Moderado', arrojado: 'Perfil Arrojado' }[value];
    UI.toast(`Perfil atualizado: ${value}`, 'success');
  }

  function simulate() {
    const monthly = parseFloat(document.getElementById('sim-monthly').value);
    const rateAnnual = parseFloat(document.getElementById('sim-rate').value);
    const years = parseInt(document.getElementById('sim-years').value);

    if (!monthly || !rateAnnual || !years) { UI.toast('Preencha todos os campos', 'error'); return; }
    if (monthly <= 0 || rateAnnual <= 0 || years <= 0) { UI.toast('Valores devem ser positivos', 'error'); return; }

    const months = years * 12;
    const rateMonthly = Math.pow(1 + rateAnnual / 100, 1/12) - 1;

    let total = 0;
    const dataPoints = [];
    const investedPoints = [];

    for (let m = 1; m <= months; m++) {
      total = (total + monthly) * (1 + rateMonthly);
      if (m % 12 === 0 || m === months) {
        dataPoints.push(parseFloat(total.toFixed(2)));
        investedPoints.push(monthly * m);
      }
    }

    const invested = monthly * months;
    const interest = total - invested;

    document.getElementById('sim-invested').textContent = _fmtVal(invested);
    document.getElementById('sim-total').textContent = _fmtVal(total);
    document.getElementById('sim-interest').textContent = _fmtVal(interest);

    const result = document.getElementById('sim-result');
    result.classList.remove('hidden');

    // Chart
    const ctx = document.getElementById('sim-chart');
    if (ctx) {
      if (window._simChartInst) { window._simChartInst.destroy(); }
      const yearLabels = Array.from({ length: years }, (_, i) => `Ano ${i+1}`);
      window._simChartInst = new Chart(ctx, {
        type: 'line',
        data: {
          labels: yearLabels,
          datasets: [
            {
              label: 'Total com rendimento',
              data: dataPoints,
              borderColor: '#00E676',
              backgroundColor: 'rgba(0,230,118,0.1)',
              borderWidth: 2, fill: true, tension: 0.4,
              pointBackgroundColor: '#00E676', pointRadius: 3,
            },
            {
              label: 'Total investido',
              data: investedPoints,
              borderColor: 'rgba(255,255,255,0.25)',
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderWidth: 1.5, fill: true, tension: 0,
              pointRadius: 2,
            }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: {
            legend: { labels: { color: '#A0A0A0', font: { size: 11 } } },
            tooltip: { callbacks: { label: c => ` ${c.dataset.label}: R$ ${c.parsed.y.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` } }
          },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#A0A0A0' } },
            y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#A0A0A0', callback: v => 'R$' + (v/1000).toFixed(0) + 'k' } }
          }
        }
      });
    }

    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ===== SETTINGS =====
  function saveSettings() {
    const salary = parseFloat(document.getElementById('settings-salary').value) || 0;
    const name = document.getElementById('settings-name').value.trim() || 'Usuário';

    const d = State.get();
    d.salary = salary;
    d.userName = name;
    State.save();

    const avatar = document.getElementById('sidebar-avatar');
    if (avatar) avatar.textContent = name[0].toUpperCase();
    const sName = document.getElementById('sidebar-profile-name');
    if (sName) sName.textContent = name;

    UI.renderDashboard();
    UI.renderCategoryList();
    UI.renderInvestments();
    UI.toast('Configurações salvas', 'success');
  }

  function toggleTheme() {
    const d = State.get();
    const isLight = document.getElementById('theme-toggle').checked === false;
    d.settings.theme = isLight ? 'light' : 'dark';
    document.body.setAttribute('data-theme', d.settings.theme);
    State.save();
  }

  function confirmResetExpenses() {
    UI.showConfirm(
      'Limpar todos os gastos?',
      'Todos os gastos registrados serão removidos permanentemente.',
      () => {
        State.get().expenses = [];
        State.save();
        UI.renderDashboard();
        UI.renderExpenses();
        UI.renderCategoryList();
        UI.toast('Gastos removidos', 'success');
      }
    );
  }

  function confirmResetAll() {
    UI.showConfirm(
      'Resetar todos os dados?',
      'Salário, gastos, categorias e metas serão apagados permanentemente.',
      () => {
        localStorage.removeItem('axion_data_v2');
        location.reload();
      }
    );
  }

  // ===== INVESTMENTS (portfólio) =====
  function addInvestment() {
    const asset  = document.getElementById('inv-asset').value.trim();
    const type   = document.getElementById('inv-type').value;
    const value  = parseFloat(document.getElementById('inv-value').value);
    const qty    = document.getElementById('inv-qty').value.trim();
    const date   = document.getElementById('inv-date').value;
    const notes  = document.getElementById('inv-notes').value.trim();

    if (!asset) { UI.toast('Informe o nome do ativo', 'error'); return; }
    if (!value || value <= 0) { UI.toast('Informe um valor válido', 'error'); return; }
    if (!date) { UI.toast('Informe a data', 'error'); return; }

    const d = State.get();
    d.investments.push({ id: _uid(), asset, type, value, qty: qty || null, date, notes: notes || null });
    State.save();
    UI.closeInvestmentModal();
    UI.renderPortfolio();
    UI.toast(`Aporte em ${asset} registrado`, 'success');
  }

  function deleteInvestment(id) {
    UI.showConfirm('Excluir aporte?', 'Esta ação não pode ser desfeita.', () => {
      const d = State.get();
      d.investments = d.investments.filter(i => i.id !== id);
      State.save();
      UI.renderPortfolio();
      UI.toast('Aporte removido');
    });
  }

  // ===== DRAWER helpers =====
  function toggleThemeDrawer() {
    const isChecked = document.getElementById('drawer-theme-toggle').checked;
    const d = State.get();
    d.settings.theme = isChecked ? 'dark' : 'light';
    document.body.setAttribute('data-theme', d.settings.theme);
    // keep main settings toggle in sync
    const tt = document.getElementById('theme-toggle');
    if (tt) tt.checked = isChecked;
    State.save();
  }

  function saveDrawerSalary() {
    const val = parseFloat(document.getElementById('drawer-salary').value) || 0;
    const d = State.get();
    d.salary = val;
    State.save();
    // sync settings page input
    const ss = document.getElementById('settings-salary');
    if (ss) ss.value = val || '';
    UI.renderDashboard();
    UI.renderCategoryList();
    UI.renderInvestments();
    UI.toast('Salário salvo', 'success');
  }

  function saveDrawerAlerts() {
    const d = State.get();
    d.settings.alertLimit = document.getElementById('drawer-alert-limit').checked;
    State.save();
    const al = document.getElementById('alert-limit');
    if (al) al.checked = d.settings.alertLimit;
  }

  // ===== HELPERS =====
  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function _fmtVal(v) {
    return 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function _filterByMonth(expenses) {
    const now = new Date();
    return expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }
  const _colors = [
    '#4FC3F7','#FF8A65','#A5D6A7','#CE93D8','#FFF176',
    '#80DEEA','#FFAB91','#C5E1A5','#F48FB1','#B0BEC5',
    '#FFD54F','#AED581','#90CAF9','#FFCC02','#26C6DA',
  ];
  let _colorIdx = 0;
  function _randomColor() {
    return _colors[_colorIdx++ % _colors.length];
  }

  return {
    addExpense, deleteExpense,
    addCategory, deleteCategory,
    addGoal, deleteGoal, addToGoal,
    addInvestment, deleteInvestment,
    updateProfile, simulate,
    saveSettings, toggleTheme,
    toggleThemeDrawer, saveDrawerSalary, saveDrawerAlerts,
    confirmResetExpenses, confirmResetAll,
  };
})();


/* ============================================================
   BOOT — Inicialização do app
   ============================================================ */
(function boot() {
  // Load data from localStorage
  State.load();

  // Hide splash after animation
  setTimeout(() => {
    const splash = document.getElementById('splash');
    if (splash) {
      splash.classList.add('fade-out');
      setTimeout(() => splash.classList.add('hidden'), 400);
    }

    const d = State.get();
    const app = document.getElementById('app');

    if (!d.onboardingDone) {
      // Show onboarding
      State.startOnboarding();
    } else {
      // Show app directly
      if (app) app.classList.remove('hidden');
      UI.init();
    }
  }, 2100);

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        // Don't close onboarding on overlay click
        if (overlay.id === 'onboarding-overlay') return;
        overlay.classList.add('hidden');
      }
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.getElementById('expense-modal')?.classList.add('hidden');
      document.getElementById('goal-modal')?.classList.add('hidden');
      document.getElementById('investment-modal')?.classList.add('hidden');
      document.getElementById('confirm-modal')?.classList.add('hidden');
      document.getElementById('learn-detail')?.classList.add('hidden');
      UI.closeSettingsDrawer();
    }
  });

  // Onboarding: show app when done
  const onboardingOverlay = document.getElementById('onboarding-overlay');
  if (onboardingOverlay) {
    onboardingOverlay.addEventListener('transitionend', () => {
      const app = document.getElementById('app');
      if (app && !app.classList.contains('hidden')) return;
      if (State.get().onboardingDone && app) {
        app.classList.remove('hidden');
      }
    });
  }
})();

