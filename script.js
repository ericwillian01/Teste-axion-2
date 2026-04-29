// === STATE MANAGER ===
const StateManager = {
    data: {
        salary: 0,
        monthlyGoal: 0,
        expenses: [],
        categories: [
            { name: 'Mercado', maxPercent: 30, color: '#EF4444' },
            { name: 'Lazer', maxPercent: 15, color: '#F59E0B' },
            { name: 'Transporte', maxPercent: 20, color: '#3B82F6' },
            { name: 'Saúde', maxPercent: 10, color: '#10B981' },
            { name: 'Educação', maxPercent: 10, color: '#8B5CF6' }
        ],
        goals: [],
        investorProfile: null,
        theme: 'dark'
    },

    init() {
        this.load();
        this.bindEvents();
        UIManager.renderAll();
        Insights.generate();
    },

    load() {
        const saved = localStorage.getItem('axion-finance');
        if (saved) {
            this.data = { ...this.data, ...JSON.parse(saved) };
        }
        document.body.className = this.data.theme;
    },

    save() {
        localStorage.setItem('axion-finance', JSON.stringify(this.data));
    },

    reset() {
        if (confirm('Tem certeza? Isso apagará todos os seus dados.')) {
            localStorage.removeItem('axion-finance');
            this.data = {
                salary: 0,
                monthlyGoal: 0,
                expenses: [],
                categories: [...this.data.categories],
                goals: [],
                investorProfile: null,
                theme: 'dark'
            };
            UIManager.renderAll();
            Insights.generate();
        }
    }
};

// === UI MANAGER ===
const UIManager = {
    elements: {},

    init() {
        this.cacheElements();
        this.bindNavigation();
        this.hideLoading();
    },

    cacheElements() {
        const ids = [
            'balance-amount', 'balance-progress', 'balance-percent',
            'total-spent', 'salary-value', 'monthly-goal',
            'insights-list', 'expenses-list', 'goals-list',
            'theme-toggle', 'settings-btn', 'add-expense-btn',
            'add-category-btn', 'add-goal-btn', 'salary-input',
            'goal-input', 'save-salary-btn', 'save-goal-btn',
            'reset-data-btn', 'add-expense-modal', 'expense-form',
            'expense-value', 'expense-category', 'expense-description',
            'setup-profile-btn', 'investment-suggestion'
        ];
        ids.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
    },

    bindNavigation() {
        // Screen navigation
        document.querySelectorAll('[data-screen]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchScreen(e.currentTarget.dataset.screen);
            });
        });

        // Bottom nav
        document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchScreen(e.currentTarget.dataset.screen);
                document.querySelectorAll('.bottom-nav .nav-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });

        // Settings button
        this.elements['settings-btn'].addEventListener('click', () => {
            this.switchScreen('settings');
        });
    },

    switchScreen(screenName) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenName).classList.add('active');
    },

    hideLoading() {
        setTimeout(() => {
            document.getElementById('loading').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loading').style.display = 'none';
            }, 500);
        }, 2000);
    },

    renderAll() {
        this.renderDashboard();
        this.renderExpenses();
        this.renderGoals();
        this.renderCategories();
        this.renderSettings();
        ChartManager.renderExpensesChart();
    },

    renderDashboard() {
        const { salary, expenses, monthlyGoal } = StateManager.data;
        const totalSpent = expenses.reduce((sum, exp) => sum + exp.value, 0);
        const balance = salary - totalSpent;
        const percentUsed = salary ? (totalSpent / salary * 100) : 0;

        // Format currency
        const formatCurrency = (value) => {
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(value);
        };

        this.elements['balance-amount'].textContent = formatCurrency(balance);
        this.elements['total-spent'].textContent = formatCurrency(totalSpent);
        this.elements['salary-value'].textContent = formatCurrency(salary);
        this.elements['monthly-goal'].textContent = formatCurrency(monthlyGoal);

        // Progress bar
        const progressFill = this.elements['balance-progress'];
        const progressText = this.elements['balance-percent'];
        progressFill.style.width = `${Math.min(percentUsed, 100)}%`;
        progressText.textContent = `${Math.round(percentUsed)}%`;

        // Status colors
        const statusIndicator = document.querySelector('.status-indicator');
        statusIndicator.className = `status-indicator ${percentUsed < 70 ? 'good' : percentUsed < 90 ? 'warning' : 'danger'}`;
    },

    renderExpenses() {
        const { expenses } = StateManager.data;
        const container = this.elements['expenses-list'];

        if (!expenses.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <h3>Nenhum gasto registrado</h3>
                    <p>Adicione seu primeiro gasto clicando no botão +</p>
                </div>
            `;
            return;
        }

        container.innerHTML = expenses.map(exp => `
            <div class="expense-item">
                <div class="expense-info">
                    <div class="expense-category">${exp.category}</div>
                    ${exp.description ? `<div class="expense-description">${exp.description}</div>` : ''}
                </div>
                <div class="expense-amount">
                    ${this.formatCurrency(exp.value)}
                </div>
            </div>
        `).join('');
    },

    renderGoals() {
        const { goals } = StateManager.data;
        const container = this.elements['goals-list'];

        if (!goals.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-bullseye"></i>
                    <h3>Nenhuma meta criada</h3>
                    <p>Crie metas para se motivar financeiramente</p>
                </div>
            `;
            return;
        }

        // Implementation for goals rendering
        container.innerHTML = goals.map(goal => `
            <div class="goal-item">
                <div>
                    <div style="font-weight: 600; margin-bottom: 4px;">${goal.name}</div>
                    <div style="font-size: 14px; opacity: 0.8;">${this.formatCurrency(goal.current)} / ${this.formatCurrency(goal.target)}</div>
                </div>
                <div class="goal-progress">
                    <div class="goal-progress-bar">
                        <div class="goal-progress-fill" style="width: ${Math.min((goal.current / goal.target) * 100, 100)}%"></div>
                    </div>
                </div>
            </div>
        `).join('');
    },

    renderCategories() {
        const select = this.elements['expense-category'];
        select.innerHTML = '<option value="">Selecione...</option>' + 
            StateManager.data.categories.map(cat => 
                `<option value="${cat.name}" data-color="${cat.color}">${cat.name} (${cat.maxPercent}% máx)</option>`
            ).join('');
    },

    renderSettings() {
        this.elements['salary-input'].value = StateManager.data.salary;
        this.elements['goal-input'].value = StateManager.data.monthlyGoal;
    },

    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    }
};

// === CHART MANAGER ===
const ChartManager = {
    canvas: null,
    ctx: null,

    init() {
        this.canvas = document.getElementById('expenses-chart');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    },

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = 250 * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    },

    renderExpensesChart() {
        const { expenses, categories } = StateManager.data;
        
        // Calculate category totals
        const categoryTotals = {};
        categories.forEach(cat => {
            categoryTotals[cat.name] = expenses
                .filter(exp => exp.category === cat.name)
                .reduce((sum, exp) => sum + exp.value, 0);
        });

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw pie chart
        const centerX = this.canvas.width / window.devicePixelRatio / 2;
        const centerY = 120;
        const radius = 90;

        let startAngle = 0;
        const total = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

        Object.entries(categoryTotals).forEach(([category, value]) => {
            if (value === 0) return;
            
            const sliceAngle = (value / total) * 2 * Math.PI;
            const categoryData = categories.find(cat => cat.name === category);
            const color = categoryData ? categoryData.color : '#6B7280';

            this.ctx.beginPath();
            this.ctx.moveTo(centerX, centerY);
            this.ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
            this.ctx.closePath();
            this.ctx.fillStyle = color;
            this.ctx.fill();
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            startAngle += sliceAngle;
        });

        // Draw center circle
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 40, 0, 2 * Math.PI);
        this.ctx.fillStyle = 'rgba(26, 26, 26, 0.8)';
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw total text
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 18px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(
            total > 0 ? UIManager.formatCurrency(total) : 'R$ 0,00',
            centerX,
            centerY
        );
    }
};

// === INSIGHTS ENGINE ===
const Insights = {
    generate() {
        const { salary, expenses, categories, monthlyGoal } = StateManager.data;
        const totalSpent = expenses.reduce((sum, exp) => sum + exp.value, 0);
        const percentUsed = salary ? (totalSpent / salary * 100) : 0;
        const container = document.getElementById('insights-list');

        let insights = [];

        // Salary usage insight
        if (salary > 0) {
            if (percentUsed < 50) {
                insights.push({
                    text: `Excelente! Você usou apenas ${Math.round(percentUsed)}% do seu salário.`,
                    type: 'good'
                });
            } else if (percentUsed < 80) {
                insights.push({
                    text: `Cuidado: você já gastou ${Math.round(percentUsed)}% do salário.`,
                    type: 'warning'
                });
            } else {
                insights.push({
                    text: `⚠️ Você gastou ${Math.round(percentUsed)}% do seu salário. Revise seus gastos!`,
                    type: 'danger'
                });
            }
        }

        // Category limit insights
        categories.forEach(category => {
            const categorySpent = expenses
                .filter(exp => exp.category === category.name)
                .reduce((sum, exp) => sum + exp.value, 0);
            const categoryLimit = (salary * category.maxPercent) / 100;
            
            if (categorySpent > categoryLimit) {
                insights.push({
                    text: `Você ultrapassou o limite de ${category.name} em ${Math.round((categorySpent / categoryLimit - 1) * 100)}%`,
                    type: 'danger'
                });
            }
        });

        // Goal progress
        if (monthlyGoal > 0) {
            const saved = salary - totalSpent;
            const goalProgress = Math.min((saved / monthlyGoal) * 100, 100);
            insights.push({
                text: `Economia: ${Math.round(goalProgress)}% da meta de ${UIManager.formatCurrency(monthlyGoal)}`,
                type: goalProgress >= 100 ? 'good' : 'warning'
            });
        }

        // Empty state
        if (!insights.length) {
            insights.push({
                text: 'Configure seu salário para insights personalizados',
                type: 'warning'
            });
        }

        // Render insights
        container.innerHTML = insights.slice(0, 3).map(insight => `
            <div class="insight-item ${insight.type}">
                <i class="fas fa-${insight.type === 'good' ? 'check-circle' : insight.type === 'warning' ? 'exclamation-triangle' : 'times-circle'}"></i>
                <span>${insight.text}</span>
            </div>
        `).join('');
    }
};

// === EVENT HANDLERS ===
const EventHandlers = {
    init() {
        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            StateManager.data.theme = StateManager.data.theme === 'dark' ? 'light' : 'dark';
            document.body.className = StateManager.data.theme;
            StateManager.save();
        });

        // Add expense modal
        document.getElementById('add-expense-btn').addEventListener('click', () => {
            document.getElementById('add-expense-modal').classList.add('active');
        });

        // Close modal
        document.querySelector('.modal-close').addEventListener('click', () => {
            document.getElementById('add-expense-modal').classList.remove('active');
        });

        // Expense form
        document.getElementById('expense-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addExpense();
        });

        // Settings
        document.getElementById('save-salary-btn').addEventListener('click', () => {
            StateManager.data.salary = parseFloat(document.getElementById('salary-input').value) || 0;
            StateManager.save();
            UIManager.renderAll();
            Insights.generate();
            UIManager.switchScreen('dashboard');
        });

        document.getElementById('save-goal-btn').addEventListener('click', () => {
            StateManager.data.monthlyGoal = parseFloat(document.getElementById('goal-input').value) || 0;
            StateManager.save();
            UIManager.renderAll();
            Insights.generate();
        });

        document.getElementById('reset-data-btn').addEventListener('click', () => {
            StateManager.reset();
        });
    },

    addExpense() {
        const value = parseFloat(document.getElementById('expense-value').value);
        const category = document.getElementById('expense-category').value;
        const description = document.getElementById('expense-description').value;

        if (value && category) {
            StateManager.data.expenses.unshift({
                id: Date.now(),
                value,
                category,
                description,
                date: new Date().toISOString()
            });

            StateManager.save();
            UIManager.renderAll();
            Insights.generate();
            ChartManager.renderExpensesChart();
            
            // Reset form
            document.getElementById('expense-form').reset();
            document.getElementById('add-expense-modal').classList.remove('active');
        }
    }
};

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    StateManager.init();
    UIManager.init();
    ChartManager.init();
    EventHandlers.init();
    
    // Auto-save on storage change
    window.addEventListener('beforeunload', () => {
        StateManager.save();
    });
});
