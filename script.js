const output = document.getElementById('output');
const accountStatus = document.getElementById('accountStatus');

let chatId = null;
let nickname = null;
let lastIndex = 0;
let poller = null;
let userColors = { SYSTEM: "#ffffff" };
let waitingFor = null;
let pendingChatId = null;

function randomColor() {
    const colors = ["#33ffcc", "#ff6b6b", "#ffd93d", "#6bc5ff", "#b76bff", "#ff9f1c", "#4caf50"];
    return colors[Math.floor(Math.random() * colors.length)];
}

async function isImage(url) {
    try {
        const res = await fetch(url, { method: 'HEAD' });
        const type = res.headers.get('Content-Type');
        return type && type.startsWith('image/');
    } catch {
        return false;
    }
}


function linkifyAndEmbed(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let container = document.createElement("span");
    let lastIndex = 0;

    text.replace(urlRegex, (url, _, offset) => {
        container.appendChild(document.createTextNode(text.slice(lastIndex, offset)));

        const a = document.createElement("a");
        a.href = url;
        a.textContent = url;
        a.target = "_blank";
        a.style.color = "#33aaff";
        container.appendChild(a);

        let ytId = null;
        if (url.includes("youtube.com/watch") || url.includes("youtu.be/")) {
            if (url.includes("youtube.com/watch")) {
                const params = new URL(url).searchParams;
                ytId = params.get("v");
            } else {
                ytId = url.split("/").pop();
            }
            if (ytId) {
                const iframe = document.createElement("iframe");
                iframe.src = `https://www.youtube.com/embed/${ytId}`;
                iframe.width = "400";
                iframe.height = "225";
                iframe.style.display = "block";
                iframe.style.marginTop = "5px";
                iframe.setAttribute("allowfullscreen", "true");
                container.appendChild(iframe);
            }
        }
        else if (/\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(url)){
          const img = document.createElement("img");
          img.src = url;
          img.style.maxWidth = "300px";
          img.style.display = "block";
          img.style.marginTop = "5px";
          container.appendChild(img);
        }
        else if (isImage(url)) {
            const img = document.createElement("img");
            img.src = url;
            img.style.maxWidth = "300px";
            img.style.display = "block";
            img.style.marginTop = "5px";
            container.appendChild(img);
        }

        lastIndex = offset + url.length;
    });

    container.appendChild(document.createTextNode(text.slice(lastIndex)));
    return container;
}

function appendLine(text, options = {}) {
    const el = document.createElement('div');
    el.className = 'line';

    if (options.sender) {
        if (!userColors[options.sender]) userColors[options.sender] = randomColor();
        const sender = document.createElement('span');
        sender.className = 'sender';
        sender.style.color = userColors[options.sender];
        sender.textContent = `<${options.sender}> `;
        el.appendChild(sender);
    }

    el.appendChild(linkifyAndEmbed(text));
    output.appendChild(el);
    output.scrollTop = output.scrollHeight;
}

function appendLine(text, options = {}) {
    const el = document.createElement('div');
    el.className = 'line';

    if (options.sender) {
        if (!userColors[options.sender]) userColors[options.sender] = randomColor();
        const sender = document.createElement('span');
        sender.className = 'sender';
        sender.style.color = userColors[options.sender];
        sender.textContent = `<${options.sender}> `;
        el.appendChild(sender);
    }

    el.appendChild(linkifyAndEmbed(text));

    if (options.embed) {
        const box = document.createElement("div");
        box.style.border = "1px solid #444";
        box.style.background = "#111";
        box.style.padding = "8px";
        box.style.marginTop = "5px";
        box.style.maxWidth = "400px";

        if (options.embed.type === "image" && options.embed.image) {
            const img = document.createElement("img");
            img.src = options.embed.image;
            img.style.maxWidth = "100%";
            box.appendChild(img);
        } else if (options.embed.type === "youtube" && options.embed.video_id) {
            const iframe = document.createElement("iframe");
            iframe.src = `https://www.youtube.com/embed/${options.embed.video_id}`;
            iframe.width = "400";
            iframe.height = "225";
            iframe.setAttribute("allowfullscreen", "true");
            box.appendChild(iframe);
        } else if (options.embed.type === "link") {
            if (options.embed.image) {
                const img = document.createElement("img");
                img.src = options.embed.image;
                img.style.maxWidth = "100%";
                img.style.display = "block";
                box.appendChild(img);
            }
            if (options.embed.title) {
                const title = document.createElement("div");
                title.textContent = options.embed.title;
                title.style.fontWeight = "bold";
                box.appendChild(title);
            }
            if (options.embed.description) {
                const desc = document.createElement("div");
                desc.textContent = options.embed.description;
                desc.style.fontSize = "14px";
                desc.style.color = "#aaa";
                box.appendChild(desc);
            }
        }

        el.appendChild(box);
    }

    output.appendChild(el);
    output.scrollTop = output.scrollHeight;
}

function clearOutput() {
    output.innerHTML = '';
}

function setStatus(s) {
    accountStatus.textContent = s;
}

async function apiPost(path, body) {
    const res = await fetch('https://roydev.pythonanywhere.com' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body)
    });
    return res.json();
}

async function apiGet(path) {
    const res = await fetch('https://roydev.pythonanywhere.com' + path);
    return res.json();
}

async function sendMessage(text) {
    if (!chatId || !nickname) {
        appendLine("You are not connected to a chat.", { sender: "SYSTEM" });
        return;
    }
    await apiPost('/send_message', { chat_id: chatId, nickname, text });
}

async function getMessages() {
    if (!chatId) return;
    const resp = await apiGet(`/get_messages/${chatId}/${lastIndex}`);
    if (resp && resp.messages) {
        for (const msg of resp.messages){
          appendLine(msg.text, { sender: msg.sender, embed: msg.embed });
           console.log(msg.embed);
        }
        lastIndex = resp.new_index || lastIndex;
    }
}

function startPolling() {
    if (!poller) poller = setInterval(getMessages, 1200);
}

function stopPolling() {
    if (poller) { clearInterval(poller); poller = null; }
}

async function joinChat(id, nick) {
    if (!nick) nick = 'Guest';
    clearOutput();
    setStatus('Joining...');
    const resp = await apiPost('/join', { chat_id: id, nickname: nick });
    if (!resp.error) {
        chatId = id;
        nickname = nick;
        setStatus(`Connected as ${nickname} (chat: ${chatId})`);
        location.hash = chatId;
        startPolling();
        appendLine(`You joined chat: ${chatId}`, { sender: "SYSTEM" });
    } else {
        appendLine('Join error: ' + resp.error, { sender: "SYSTEM" });
        setStatus('Error');
    }
}

async function createNewChat(nick) {
    if (!nick) nick = 'Guest';
    clearOutput();
    const resp = await apiPost('/new_chat', {});
    const id = resp.chat_id || resp.id;
    if (id) joinChat(id, nick);
}

async function leaveChat() {
    if (!chatId || !nickname) {
        appendLine("Not connected.", { sender: "SYSTEM" });
        return;
    }
    await apiPost('/leave', { chat_id: chatId, nickname });
    appendLine('You left the chat.', { sender: "SYSTEM" });
    chatId = null;
    nickname = null;
    setStatus('Not connected');
    stopPolling();
    location.hash = '';
}

async function handleCommand(input) {
    if (waitingFor === "new") { waitingFor = null; await createNewChat(input); return; }
    if (waitingFor === "join") { waitingFor = null; await joinChat(pendingChatId, input); pendingChatId = null; return; }

    const parts = input.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();

    if (cmd === "new") { appendLine("Enter your nickname:", { sender: "SYSTEM" }); waitingFor = "new"; return; }
    if (cmd === "join") {
        if (parts.length < 2) { appendLine("Usage: join <chatId>", { sender: "SYSTEM" }); return; }
        pendingChatId = parts[1];
        appendLine(`Joining chat ${pendingChatId}. Enter your nickname:`, { sender: "SYSTEM" });
        waitingFor = "join";
        return;
    }
    if (cmd === "leave") { await leaveChat(); return; }
    if (cmd === "help") {
        appendLine("Available commands:", { sender: "SYSTEM" });
        appendLine("new                → create a new chat (nickname asked after)", { sender: "SYSTEM" });
        appendLine("join <id>          → join a chat (nickname asked after)", { sender: "SYSTEM" });
        appendLine("leave              → leave the chat", { sender: "SYSTEM" });
        appendLine("help               → show this help", { sender: "SYSTEM" });
        return;
    }
    await sendMessage(input);
}

document.getElementById('sendBtn').addEventListener('click', async () => {
    const msg = document.getElementById('messageInput').value.trim();
    if (msg) { document.getElementById('messageInput').value = ''; handleCommand(msg); }
});

document.getElementById('messageInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('sendBtn').click(); }
});

document.getElementById('newBtn').addEventListener('click', () => {
    appendLine("Creating a new chat. Enter your nickname:", { sender: "SYSTEM" });
    waitingFor = "new";
});
document.getElementById('joinBtn').addEventListener('click', () => {
    appendLine("Enter the chat ID with: join <id>", { sender: "SYSTEM" });
});
document.getElementById('leaveBtn').addEventListener('click', () => {
    document.getElementById('messageInput').value = "leave";
    document.getElementById('sendBtn').click();
});

const hashChat = location.hash.slice(1);
if (hashChat) {
    pendingChatId = hashChat;
    waitingFor = "join";
    appendLine(`Chat ID detected in URL: ${hashChat}`, { sender: "SYSTEM" });
    appendLine("Enter your nickname:", { sender: "SYSTEM" });
}

document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("buyBtn").addEventListener("click", function() {
        window.open("https://example.com", "_blank");
    });
});
