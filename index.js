import fetch from "node-fetch";
import WebSocket from "ws";
import xhr2Pkg from "xhr2";
import centrifugePkg from "centrifuge";

const { XMLHttpRequest } = xhr2Pkg;
const Centrifuge =
    centrifugePkg.default?.Centrifuge ||
    centrifugePkg.Centrifuge ||
    centrifugePkg.default ||
    centrifugePkg;

// Эмуляция браузерной среды
global.WebSocket = WebSocket;
global.XMLHttpRequest = XMLHttpRequest;
global.fetch = fetch;

// === НАСТРОЙКИ ===
const ACCESS_TOKEN = "K3Z0Au4ykmrd9I9bdNFZAWuE3S32FfMDA2FJi5uvdYaDk5xoW0oKv1rdL7d4";
const USER_ID = "1374865";
const TSHOCK_API = "http://127.0.0.1:25565"; // теперь твой сервер Terraria

// === ТАБЛИЦА НАГРАД ===
const DONATE_ACTIONS = [
    { min: 50,  command: "say Спасибо за поддержку!" },
    { min: 100, command: "give {name} 29 1" },
    { min: 250, command: "say {name} топ донатер! Получай сокровище!" },
    { min: 500, command: "spawnmob eyeofcthulhu" }
];

// === Проверка доступности сервера TShock ===
async function checkTShockStatus() {
    try {
        const res = await fetch(`${TSHOCK_API}/v2/server/status`);
        if (!res.ok) throw new Error("не ответил");
        const data = await res.json();
        console.log(`🟢 Сервер Terraria запущен: игроков ${data.playercount}/${data.maxplayers}`);
        return true;
    } catch (err) {
        console.log("🔴 Сервер Terraria не отвечает:", err.message);
        return false;
    }
}

// === Отправить команду на сервер Terraria ===
async function sendToTShock(cmd) {
    try {
        const res = await fetch(`${TSHOCK_API}/v2/server/rawcmd`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cmd }),
        });

        if (res.ok) {
            console.log(`🧩 Команда выполнена: ${cmd}`);
        } else {
            console.log(`⚠️ Ошибка выполнения команды (${res.status})`);
        }
    } catch (err) {
        console.log("🚫 Не удалось подключиться к серверу Terraria:", err.message);
    }
}

// === Получить токен Centrifugo (DonatePay) ===
async function getSocketToken() {
    const res = await fetch("https://donatepay.ru/api/v2/socket/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: ACCESS_TOKEN }),
    });

    const text = await res.text();
    console.log("Ответ DonatePay:", text);
    const data = JSON.parse(text);
    return data.token;
}

// === Основной процесс ===
async function start() {
    console.log("🔄 Проверяю Terraria сервер...");
    await checkTShockStatus();

    console.log("🔄 Получаю токен DonatePay...");
    const token = await getSocketToken();

    const centrifuge = new Centrifuge("wss://centrifugo.donatepay.ru/connection/websocket", {
        subscribeEndpoint: "https://donatepay.ru/api/v2/socket/token",
        subscribeParams: { access_token: ACCESS_TOKEN },
        disableWithCredentials: true,
    });

    centrifuge.setToken(token);
    const channel = `$public:${USER_ID}`;
    console.log(`📡 Подписка на канал ${channel}...`);

    // === Обработка донатов ===
    centrifuge.subscribe(channel, async (message) => {
        const vars = message?.data?.notification?.vars;
        if (!vars) return console.log("⚠️ Не найден объект vars в сообщении");

        const name = vars.name || "Неизвестный";
        const amount = vars.sum || 0;
        const msg = vars.comment || "";

        console.log("———————————————");
        console.log(`💰 Донат от: ${name}`);
        console.log(`💵 Сумма: ${amount}₽`);
        console.log(`💬 Сообщение: ${msg}`);

        const isServerUp = await checkTShockStatus();
        if (!isServerUp) {
            console.log("❌ Команды не будут отправлены — сервер недоступен.");
            console.log("———————————————");
            return;
        }

        for (const action of DONATE_ACTIONS) {
            if (amount >= action.min) {
                const cmd = action.command.replace("{name}", name);
                await sendToTShock(cmd);
            }
        }
        console.log("———————————————");
    });

    centrifuge.on("connect", () => console.log("✅ Подключено к DonatePay"));
    centrifuge.on("disconnect", () => console.log("❌ Отключено от DonatePay"));
    centrifuge.on("error", (err) => console.error("⚠️ Ошибка:", err));

    centrifuge.connect();
}

start();

// Чтобы Node не завершился
setInterval(() => {}, 1000);