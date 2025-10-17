// Tab Navigation
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// WebSocket connection for real-time updates
let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

function connectWebSocket() {
    try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('WebSocket connected');
            reconnectAttempts = 0;
            updateConnectionStatus(true);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'log') {
                    addLog(data.data);
                } else if (data.type === 'status') {
                    updateStatusDisplay(data.data);
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
            updateConnectionStatus(false);

            if (reconnectAttempts < maxReconnectAttempts) {
                setTimeout(() => {
                    reconnectAttempts++;
                    connectWebSocket();
                }, 3000);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

    } catch (error) {
        console.error('WebSocket connection failed:', error);
    }
}

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connection-status');
    if (!indicator) return;

    if (connected) {
        indicator.className = 'status-card online';
        indicator.querySelector('.status-info p').textContent = 'Подключено к серверу';
    } else {
        indicator.className = 'status-card offline';
        indicator.querySelector('.status-info p').textContent = 'Отключено от сервера';
    }
}

// Status display
function updateStatusDisplay(status) {
    for (const [key, value] of Object.entries(status)) {
        const element = document.getElementById(`status-${key}`);
        if (element) {
            element.className = `status-card ${value}`;

            const statusText = {
                'online': 'Онлайн',
                'offline': 'Оффлайн',
                'connecting': 'Подключение...',
                'starting': 'Запуск...',
                'running': 'Работает',
                'stopped': 'Остановлен',
                'error': 'Ошибка',
                'unknown': 'Проверка...'
            }[value] || value;

            element.querySelector('.status-info p').textContent = statusText;
        }
    }
}

// Log management
function addLog(message, type = 'info') {
    const container = document.getElementById('log-container');
    if (!container) return;

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = message;

    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;

    // Auto-remove old logs if too many
    const entries = container.querySelectorAll('.log-entry');
    if (entries.length > 500) {
        entries[0].remove();
    }
}

// Settings management
async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        if (!response.ok) throw new Error('Failed to load settings');

        const settings = await response.json();

        // Fill basic settings
        document.getElementById('token').value = settings.ACCESS_TOKEN || '';
        document.getElementById('user').value = settings.USER_ID || '';
        document.getElementById('api').value = settings.TSHOCK_API || '';
        document.getElementById('tshToken').value = settings.TOKEN || '';

        // Fill advanced settings
        if (settings.ADVANCED) {
            document.getElementById('auto-start').value = settings.ADVANCED.autoStart.toString();
            document.getElementById('log-level').value = settings.ADVANCED.logLevel || 'info';
            document.getElementById('check-interval').value = settings.ADVANCED.checkInterval || 30;
            document.getElementById('backup-interval').value = settings.ADVANCED.backupInterval || 60;
        }

        // Render commands
        renderCommands(settings.COMMANDS || []);

    } catch (error) {
        console.error('Error loading settings:', error);
        addLog('❌ Ошибка загрузки настроек', 'error');
    }
}

async function saveSettings(showPopup = true) {
    try {
        const settings = await collectSettings();
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const result = await response.json();

        if (result && result.success) {
            if (showPopup) addLog('✅ Настройки сохранены', 'success');
            return true;
        } else {
            throw new Error(result?.message || 'Неизвестная ошибка при сохранении');
        }

    } catch (error) {
        addLog(`❌ Ошибка сохранения: ${error.message}`, 'error');
        console.error('Error saving settings:', error);
        return false;
    }
}

async function collectSettings() {
    const commands = getCurrentCommands();

    return {
        ACCESS_TOKEN: document.getElementById('token').value.trim(),
        USER_ID: document.getElementById('user').value.trim(),
        TSHOCK_API: document.getElementById('api').value.trim(),
        TOKEN: document.getElementById('tshToken').value.trim(),
        COMMANDS: commands,
        ADVANCED: {
            autoStart: document.getElementById('auto-start').value === 'true',
            logLevel: document.getElementById('log-level').value,
            checkInterval: parseInt(document.getElementById('check-interval').value) || 30,
            backupInterval: parseInt(document.getElementById('backup-interval').value) || 60
        }
    };
}

// Command management
function renderCommands(commands = []) {
    const container = document.getElementById('commands-container');
    if (!container) return;

    if (commands.length === 0) {
        container.innerHTML = `
            <div class="command-block">
                <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <i class="fas fa-code" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <p>Команды не настроены. Добавьте первую команду для обработки донатов.</p>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = commands.map((cmd, index) => `
        <div class="command-block slide-up">
            <div class="command-header">
                <div class="command-title">Команда #${index + 1}</div>
                <div class="command-controls">
                    <button class="btn btn-icon" onclick="moveCommandUp(${index})">
                        <i class="fas fa-arrow-up"></i>
                    </button>
                    <button class="btn btn-icon" onclick="moveCommandDown(${index})">
                        <i class="fas fa-arrow-down"></i>
                    </button>
                    <button class="btn btn-icon btn-danger" onclick="removeCommand(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="command-form">
                <div class="form-group">
                    <label>Минимальная сумма</label>
                    <input type="number" class="form-control min-amount" value="${cmd.min || 0}" min="0">
                </div>
                <div class="form-group">
                    <label>Режим выполнения</label>
                    <select class="form-control execution-mode">
                        <option value="all" ${cmd.mode === 'all' ? 'selected' : ''}>Все команды</option>
                        <option value="random:1" ${cmd.mode === 'random:1' ? 'selected' : ''}>1 случайная</option>
                        <option value="random:2" ${cmd.mode === 'random:2' ? 'selected' : ''}>2 случайные</option>
                        <option value="random:3" ${cmd.mode === 'random:3' ? 'selected' : ''}>3 случайные</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Команды (по одной на строку)</label>
                    <textarea class="form-control command-lines" placeholder="Например:&#10;say Спасибо {name} за донат {sum} рублей!&#10;give {name} gold 10">${(cmd.commands || []).join('\n')}</textarea>
                </div>
            </div>
        </div>
    `).join('');
}

function getCurrentCommands() {
    const commands = [];
    document.querySelectorAll('.command-block').forEach(block => {
        const min = parseInt(block.querySelector('.min-amount').value) || 0;
        const mode = block.querySelector('.execution-mode').value;
        const commandText = block.querySelector('.command-lines').value;
        const commandsList = commandText.split('\n').filter(cmd => cmd.trim() !== '');

        commands.push({ min, mode, commands: commandsList });
    });
    return commands;
}

function moveCommandUp(index) {
    const commands = getCurrentCommands();
    if (index > 0) {
        [commands[index], commands[index - 1]] = [commands[index - 1], commands[index]];
        renderCommands(commands);
    }
}

function moveCommandDown(index) {
    const commands = getCurrentCommands();
    if (index < commands.length - 1) {
        [commands[index], commands[index + 1]] = [commands[index + 1], commands[index]];
        renderCommands(commands);
    }
}

function removeCommand(index) {
    const commands = getCurrentCommands();
    commands.splice(index, 1);
    renderCommands(commands);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Load initial settings
    loadSettings();

    // Connect WebSocket
    connectWebSocket();

    // Add connection status indicator
    // Добавление индикатора соединения с сервером
    const statusGrid = document.querySelector('.status-grid');
    if (statusGrid && !document.getElementById('connection-status')) {
        const connectionCard = document.createElement('div');
        connectionCard.className = 'status-card unknown';
        connectionCard.id = 'connection-status';
        connectionCard.innerHTML = `
        <div class="status-icon">
            <i class="fas fa-wifi"></i>
        </div>
        <div class="status-info">
            <h3>Соединение с сервером</h3>
            <p>Подключение...</p>
        </div>
    `;
        statusGrid.prepend(connectionCard);
    }

    // Settings buttons
    document.getElementById('save-settings')?.addEventListener('click', saveSettings);
    document.getElementById('save-advanced')?.addEventListener('click', saveSettings);

    // Commands buttons
    document.getElementById('add-command')?.addEventListener('click', () => {
        const commands = getCurrentCommands();
        commands.push({ min: 0, mode: 'all', commands: [] });
        renderCommands(commands);
    });

    document.getElementById('save-commands')?.addEventListener('click', async () => {
        await saveSettings(false); // передаём флаг "без логов"
        addLog('✅ Команды сохранены', 'success');
    });

    // Logs buttons
    document.getElementById('clear-logs')?.addEventListener('click', () => {
        document.getElementById('log-container').innerHTML = '';
        addLog('🗑️ Логи очищены', 'warning');
    });

    let logsPaused = false;
    document.getElementById('pause-logs')?.addEventListener('click', function() {
        logsPaused = !logsPaused;
        this.innerHTML = logsPaused ?
            '<i class="fas fa-play"></i>' :
            '<i class="fas fa-pause"></i>';
        addLog(logsPaused ? '⏸️ Логи приостановлены' : '▶️ Логи возобновлены', 'warning');
    });

    // Service control
    document.getElementById('restart-service')?.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/restart', { method: 'POST' });
            const result = await response.json();

            if (result.success) {
                addLog('🔄 Сервис перезапускается...', 'success');
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            addLog(`❌ Ошибка перезапуска: ${error.message}`, 'error');
        }
    });

    document.getElementById('reset-settings')?.addEventListener('click', () => {
        if (confirm('Вы уверены, что хотите сбросить все настройки к значениям по умолчанию?')) {
            // Здесь можно добавить логику сброса настроек
            addLog('⚙️ Сброс настроек...', 'warning');
        }
    });
});

// Make functions globally available for HTML onclick
window.moveCommandUp = moveCommandUp;
window.moveCommandDown = moveCommandDown;
window.removeCommand = removeCommand;

// === Popup Notification ===
function showPopup(message, type = 'success') {
    const popup = document.createElement('div');
    popup.className = `popup-message ${type}`;
    popup.textContent = message;

    Object.assign(popup.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: type === 'error' ? '#ef4444' :
            type === 'warning' ? '#f59e0b' :
                '#10b981',
        color: '#fff',
        padding: '12px 20px',
        borderRadius: '10px',
        fontWeight: '600',
        boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
        opacity: '0',
        transform: 'translateY(-10px)',
        transition: 'all 0.3s ease',
        zIndex: '9999',
    });

    document.body.appendChild(popup);

    // animate in
    requestAnimationFrame(() => {
        popup.style.opacity = '1';
        popup.style.transform = 'translateY(0)';
    });

    // remove after 2 seconds
    setTimeout(() => {
        popup.style.opacity = '0';
        popup.style.transform = 'translateY(-10px)';
        setTimeout(() => popup.remove(), 300);
    }, 2000);
}

// === Hook into existing events ===
const oldAddLog = window.addLog;
window.addLog = function(message, type = 'info') {
    oldAddLog?.(message, type);
    if (type === 'success') showPopup(message, 'success');
    if (type === 'error') showPopup(message, 'error');
    if (type === 'warning') showPopup(message, 'warning');
};