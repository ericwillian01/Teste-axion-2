/**
 * Axion Finance - Core Application
 */

// 1. STATE MANAGEMENT
const state = {
user: {
name: "Alex Vance",
investorProfile: localStorage.getItem('axion_profile') || 'Moderate',
salary: parseFloat(localStorage.getItem('axion_salary')) || 12000.00
},

expenses: JSON.parse(localStorage.getItem('axion_expenses')) || [
{ id: 1, category: 'Mercado', value: 1200, date: '2024-03-01' },
{ id: 2, category: 'Lazer', value: 800, date: '2024-03-05' },
{ id: 3, category: 'Transporte', value: 450, date: '2024-03-10' }
],

categories: JSON.parse(localStorage.getItem('axion_categories')) || [
{ name: 'Mercado', limit: 2000 },
{ name: 'Lazer', limit: 1000 },
{ name: 'Transporte', limit: 600 },
{ name: 'Saúde', limit: 1500 },
{ name: 'Educação', limit: 2000 }
],

goals: JSON.parse(localStorage.getItem('axion_goals')) || [
{ name: 'Reserva de Emergência', target: 25000, current: 18400 },
{ name: 'Novo Carro', target: 60000, current: 42000 }
]
};

function saveData() {
localStorage.setItem('axion_expenses', JSON.stringify(state.expenses));
localStorage.setItem('axion_categories', JSON.stringify(state.categories));
localStorage.setItem('axion_goals', JSON.stringify(state.goals));
localStorage.setItem('axion_profile', state.user.investorProfile);
localStorage.setItem('axion_salary', state.user.salary);
}

// 2. LOGIC
const logic = {
getTotalSpent: () => state.expenses.reduce((acc, curr) => acc + curr.value, 0),
getSpendingPercentage: () => (logic.getTotalSpent() / state.user.salary) * 100,

getInsights: () => {
const percent = logic.getSpendingPercentage();

if (percent > 90) return "Alerta Crítico: Você atingiu 90% do seu orçamento mensal.";
if (percent > 70) return "Atenção: Seus gastos estão acelerados este mês. Revise seus custos.";

return "Desempenho Excelente: Suas finanças estão sob controle absoluto.";
}
};

// 3. UI
const ui = {

renderDashboard: () => {
const main = document.getElementById('main-content');
const spent = logic.getTotalSpent();
const percent = logic.getSpendingPercentage().toFixed(1);

main.innerHTML = `
<div class="p-6 md:p-12 animate-in">

<header class="mb-10 flex justify-between items-end">
<div>
<h2 class="text-3xl font-black mb-2 italic">Visão Geral</h2>
<p class="text-gray-500">Seu centro de comando financeiro.</p>
</div>
</header>

<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">

<div class="bg-[#161616] border border-white/5 p-8 rounded-3xl relative overflow-hidden">
<p class="text-gray-500 text-xs uppercase tracking-widest mb-2">Saldo Restante</p>
<h3 class="text-4xl font-black italic">R$ ${(state.user.salary - spent).toLocaleString()}</h3>
</div>

<div class="bg-[#161616] border border-white/5 p-8 rounded-3xl">
<p class="text-gray-500 text-xs uppercase tracking-widest mb-2">Gasto Mensal</p>
<h3 class="text-4xl font-black italic">R$ ${spent.toLocaleString()}</h3>
<div class="mt-4 w-full bg-white/5 h-2 rounded-full overflow-hidden">
<div class="bg-[#FF3B3B] h-full" style="width: ${percent}%"></div>
</div>
<p class="mt-2 text-[10px] text-gray-500 uppercase">${percent}% do salário utilizado</p>
</div>

<div class="bg-[#FF3B3B] p-8 rounded-3xl text-white">
<p class="text-white/60 text-xs uppercase tracking-widest mb-2">Axion Insight</p>
<p class="font-bold text-lg leading-tight">"${logic.getInsights()}"</p>
</div>

</div>

<div class="bg-[#161616] p-8 rounded-3xl border border-white/5">
<h4 class="text-xl font-bold mb-6 italic tracking-tight text-center">Distribuição</h4>
<div class="h-64 relative">
<canvas id="mainChart"></canvas>
</div>
</div>

</div>
`;

ui.initChart();
},

initChart: () => {
const ctx = document.getElementById('mainChart')?.getContext('2d');
if (!ctx) return;

new Chart(ctx, {
type: 'doughnut',
data: {
labels: state.categories.map(c => c.name),
datasets: [{
data: state.categories.map(c =>
state.expenses
.filter(e => e.category === c.name)
.reduce((a,b) => a + b.value, 0)
),
backgroundColor: ['#FF3B3B','#333','#1E1E1E','#444','#555'],
borderWidth: 0
}]
},
options: {
responsive: true,
maintainAspectRatio: false,
plugins: { legend: { display: false } },
cutout: '85%'
}
});
},

renderPortfolio: () => {
document.getElementById('main-content').innerHTML = `
<div class="p-6 md:p-12 animate-in text-center">
<h2 class="text-3xl font-black mb-4">Portfólio em Breve</h2>
</div>
`;
},

renderLearning: () => {
document.getElementById('main-content').innerHTML = `
<div class="p-6 md:p-12 animate-in">
<h2 class="text-3xl font-black mb-10 italic">Learning Hub</h2>
</div>
`;
},

renderSettings: () => {
document.getElementById('main-content').innerHTML = `
<div class="p-6 md:p-12 animate-in">
<h2 class="text-3xl font-black mb-10 italic">Ajustes</h2>
<button onclick="router.resetApp()">Apagar Tudo</button>
</div>
`;
}
};

// 4. ROUTER
const router = {
navigate: (page) => {
switch(page) {
case 'dashboard': ui.renderDashboard(); break;
case 'portfolio': ui.renderPortfolio(); break;
case 'learning': ui.renderLearning(); break;
case 'settings': ui.renderSettings(); break;
default: ui.renderDashboard();
}
},

resetApp: () => {
if(confirm("Tem certeza?")) {
localStorage.clear();
location.reload();
}
}
};

// INIT
document.addEventListener('DOMContentLoaded', () => router.navigate('dashboard'));
