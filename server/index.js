import fetch from "node-fetch";
import WebSocket, { WebSocketServer } from "ws";
import xhr2Pkg from "xhr2";
import centrifugePkg from "centrifuge";
import express from "express";
import fs from "fs";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";

const { XMLHttpRequest } = xhr2Pkg;
const Centrifuge =
    centrifugePkg.default?.Centrifuge ||
    centrifugePkg.Centrifuge ||
    centrifugePkg.default ||
    centrifugePkg;

global.WebSocket = WebSocket;
global.XMLHttpRequest = XMLHttpRequest;
global.fetch = fetch;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = path.join(process.cwd(), "settings.json");

// === создаём settings.json, если нет ===
if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(
        SETTINGS_FILE,
        JSON.stringify(
            {
                ACCESS_TOKEN: "",
                USER_ID: "",
                TSHOCK_API: "http://127.0.0.1:25565",
                TOKEN: "123456",
                COMMANDS: [
                    { min: 50, mode: "all", commands: ["say Спасибо {name} за донат {sum} рублей!"] },
                    { min: 100, mode: "random:1", commands: ["spawnmob zombie", "spawnmob slime"] },
                ],
                ADVANCED: {
                    autoStart: true,
                    logLevel: "info",
                    checkInterval: 30,
                    backupInterval: 60,
                },
            },
            null,
            2
        )
    );
}

let settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
let BASE_URL = "";

const app = express();
const server = http.createServer(app);
const wsClients = new Set();

app.use(express.json());
app.use(express.static(path.join(__dirname, "../web")));

// API Routes
app.get("/api/settings", (req, res) => {
    res.json(settings);
});

app.post("/api/settings", async (req, res) => {
    try {
        settings = { ...settings, ...req.body };

        // Обновляем BASE_URL при изменении TSHOCK_API
        if (req.body.TSHOCK_API) {
            BASE_URL = `${settings.TSHOCK_API}/v3/server/rawcmd?cmd=/sudo%20Bebrok%20`;
        }

        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        logToClients("💾 Настройки сохранены");
        res.json({ success: true, message: "Настройки сохранены" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get("/api/status", async (req, res) => {
    try {
        const terrariaStatus = await checkTShockStatus();
        res.json({
            terraria: terrariaStatus ? "online" : "offline",
            donatepay: currentStatus.donatepay,
            bot: currentStatus.bot
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/restart", (req, res) => {
    logToClients("🔄 Перезапуск сервиса...");
    setTimeout(() => {
        startBot();
        res.json({ success: true, message: "Сервис перезапущен" });
    }, 1000);
});

const WEB_PORT = process.env.PORT || 8080;
server.listen(WEB_PORT, "0.0.0.0", () => {
    console.log(`🌐 Панель BDPTI запущена: http://localhost:${WEB_PORT}`);
    console.log(`📁 Статические файлы из: ${path.join(__dirname, "../web")}`);
});

// WebSocket для реального времени
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
    wsClients.add(ws);
    ws.send(JSON.stringify({
        type: "status",
        data: currentStatus
    }));

    // Отправляем текущие логи при подключении
    recentLogs.forEach(log => {
        ws.send(JSON.stringify({ type: "log", data: log }));
    });

    ws.on("close", () => wsClients.delete(ws));
    ws.on("error", () => wsClients.delete(ws));
});

// Инициализация BASE_URL
BASE_URL = `${settings.TSHOCK_API}/v3/server/rawcmd?cmd=/sudo%20Bebrok%20`;

const currentStatus = {
    terraria: "unknown",
    donatepay: "unknown",
    bot: "starting",
};

const recentLogs = [];
const MAX_LOG_HISTORY = 1000;

function updateStatus(part, state) {
    currentStatus[part] = state;
    const message = JSON.stringify({ type: "status", data: currentStatus });

    wsClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });
}

function logToClients(msg) {
    const timestamp = new Date().toLocaleTimeString();
    const fullMessage = `[${timestamp}] ${msg}`;

    console.log(fullMessage);

    // Сохраняем в историю
    recentLogs.push(fullMessage);
    if (recentLogs.length > MAX_LOG_HISTORY) {
        recentLogs.shift();
    }

    const message = JSON.stringify({ type: "log", data: fullMessage });

    wsClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });
}

// Проверка Terraria сервера
async function checkTShockStatus() {
    try {
        const res = await fetch(`${settings.TSHOCK_API}/v2/server/status?token=${settings.TOKEN}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        updateStatus("terraria", "online");
        return true;
    } catch (error) {
        updateStatus("terraria", "offline");
        return false;
    }
}

// Отправка команды на Terraria
async function sendToTShock(cmd) {
    try {
        const encoded = encodeURIComponent(cmd);
        const url = `${BASE_URL}${encoded}&token=${settings.TOKEN}`;
        const res = await fetch(url);

        if (res.ok) {
            logToClients(`✅ Выполнено: ${cmd}`);
            return true;
        } else {
            logToClients(`⚠️ Ошибка (${res.status}) при команде: ${cmd}`);
            return false;
        }
    } catch (error) {
        logToClients(`🚫 Ошибка отправки: ${error.message}`);
        return false;
    }
}

// Получение токена DonatePay
async function getSocketToken() {
    try {
        const res = await fetch("https://donatepay.ru/api/v2/socket/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: settings.ACCESS_TOKEN }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        return data.token;
    } catch (error) {
        logToClients(`❌ Ошибка получения токена DonatePay: ${error.message}`);
        throw error;
    }
}

// Основная логика бота
async function startBot() {
    logToClients("🔄 Запуск BDPTI бота...");
    updateStatus("bot", "starting");

    // Проверяем Terraria сервер
    logToClients("🔍 Проверяю Terraria сервер...");
    const terrariaOnline = await checkTShockStatus();

    if (!terrariaOnline) {
        logToClients("⚠️ Terraria сервер недоступен. Бот будет работать в режиме ожидания.");
    }

    // Проверяем настройки DonatePay
    if (!settings.ACCESS_TOKEN || !settings.USER_ID) {
        logToClients("❌ Укажите DonatePay Token и User ID в настройках!");
        updateStatus("bot", "stopped");
        updateStatus("donatepay", "offline");
        return;
    }

    logToClients("🔗 Подключаюсь к DonatePay...");
    updateStatus("donatepay", "connecting");

    try {
        const token = await getSocketToken();

        const centrifuge = new Centrifuge("wss://centrifugo.donatepay.ru/connection/websocket", {
            subscribeEndpoint: "https://donatepay.ru/api/v2/socket/token",
            subscribeParams: { access_token: settings.ACCESS_TOKEN },
            disableWithCredentials: true,
        });

        centrifuge.setToken(token);
        const channel = `$public:${settings.USER_ID}`;

        logToClients(`📡 Подписка на канал: ${channel}`);

        centrifuge.subscribe(channel, async (message) => {
            const vars = message?.data?.notification?.vars;
            if (!vars) return;

            const name = vars.name || "Аноним";
            const amount = parseFloat(vars.sum) || 0;
            const msg = vars.comment || "";

            logToClients(`💰 Донат от ${name} — ${amount}₽: ${msg}`);

            // Проверяем доступность Terraria перед выполнением команд
            const isTerrariaOnline = await checkTShockStatus();
            if (!isTerrariaOnline) {
                logToClients("⚠️ Terraria сервер недоступен, команды не выполнены");
                return;
            }

            // Выполняем команды по условиям
            try {
                // Находим все подходящие по сумме блоки
                const eligibleActions = settings.COMMANDS
                    .filter(action => amount >= action.min)
                    .sort((a, b) => b.min - a.min); // сортируем по убыванию min

                if (eligibleActions.length === 0) {
                    logToClients(`⚠️ Нет команд для суммы ${amount}₽`);
                    return;
                }

                // Берём только самый подходящий (с наибольшим min)
                const action = eligibleActions[0];
                let commandsToExecute = [...action.commands];

                // Если режим random — выбираем нужное количество случайных команд
                if (action.mode && action.mode.startsWith("random")) {
                    const count = parseInt(action.mode.split(":")[1]) || 1;
                    commandsToExecute = commandsToExecute
                        .sort(() => Math.random() - 0.5)
                        .slice(0, count);
                }

                // Выполняем каждую команду по очереди
                for (const cmd of commandsToExecute) {
                    const processedCmd = cmd
                        .replace(/{name}/g, name)
                        .replace(/{sum}/g, amount)
                        .replace(/{msg}/g, msg);

                    await sendToTShock(processedCmd);
                    await new Promise(resolve => setTimeout(resolve, 100)); // небольшая задержка
                }

                logToClients(`✅ Выполнен набор команд для доната ${amount}₽ (min: ${action.min})`);
            } catch (err) {
                logToClients(`🚫 Ошибка при обработке доната: ${err.message}`);
            }
        });

        centrifuge.on("connect", () => {
            logToClients("✅ DonatePay подключен");
            updateStatus("donatepay", "online");
            updateStatus("bot", "running");
        });

        centrifuge.on("disconnect", () => {
            logToClients("❌ DonatePay отключен");
            updateStatus("donatepay", "offline");
            updateStatus("bot", "error");
        });

        centrifuge.on("error", (error) => {
            logToClients(`⚠️ Ошибка DonatePay: ${error.message}`);
            updateStatus("donatepay", "error");
        });

        centrifuge.connect();

    } catch (error) {
        logToClients(`❌ Ошибка подключения к DonatePay: ${error.message}`);
        updateStatus("donatepay", "error");
        updateStatus("bot", "error");
    }
}

// Периодическая проверка статуса
setInterval(async () => {
    await checkTShockStatus();
}, 30000); // Каждые 30 секунд

// Запуск бота
startBot();

// Обработка graceful shutdown
process.on('SIGINT', () => {
    logToClients("🛑 Остановка BDPTI бота...");
    process.exit(0);
});