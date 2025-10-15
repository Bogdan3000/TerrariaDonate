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
const ACCESS_TOKEN = "cNczbdJnLGrJEJLburoudonCHQzWAjj9i01L9J7uc3ZhQoJAGNfMegNjHogU";
const USER_ID = "1377866";

// === ФУНКЦИЯ: получить socket-токен от DonatePay ===
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

// === ЗАПУСК CENTRIFUGO ===
async function start() {
    console.log("🔄 Получаю токен...");
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