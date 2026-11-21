const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 250 * 1024 * 1024 });

app.use(express.static(path.join(__dirname, 'public')));

let groupName = "🌸Hello Dosto😊🙂";
let connectedUsers = {};
let messagesHistory = [];

io.on('connection', (socket) => {
    socket.on('join-chat', (name) => {
        socket.username = name;
        connectedUsers[socket.id] = name;

        const joinMsg = {
            id: 'sys_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            type: 'system',
            content: `${name} चैट में शामिल हो गए हैं।`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        messagesHistory.push(joinMsg);
        if (messagesHistory.length > 250) messagesHistory.shift();
        io.emit('chat-message', joinMsg);

        socket.emit('update-group-name', groupName);
        socket.emit('load-history', messagesHistory);
        io.emit('update-users-list', Object.values(connectedUsers));
    });

    socket.on('chat-message', (data) => {
        messagesHistory.push(data);
        if (messagesHistory.length > 250) messagesHistory.shift();
        io.emit('chat-message', data);
    });

    // Delete message for everyone
    socket.on('delete-for-everyone', ({ messageId, senderName }) => {
        const msgIndex = messagesHistory.findIndex((m) => m.id === messageId);
        if (msgIndex !== -1) {
            if (messagesHistory[msgIndex].name === senderName) {
                messagesHistory[msgIndex] = {
                    ...messagesHistory[msgIndex],
                    type: 'deleted',
                    content: '🚫 यह संदेश डिलीट कर दिया गया है।',
                    replyTo: null,
                    reactions: {}
                };
                io.emit('message-deleted-everyone', {
                    messageId,
                    content: '🚫 यह संदेश डिलीट कर दिया गया है।'
                });
            }
        }
    });

    socket.on('mark-seen', ({ messageId, name }) => {
        const msg = messagesHistory.find((m) => m.id === messageId);
        if (msg && msg.type !== 'system' && msg.type !== 'deleted') {
            if (!msg.seenBy) msg.seenBy = [];
            if (!msg.seenBy.includes(name)) {
                msg.seenBy.push(name);
                io.emit('update-seen', { messageId, seenBy: msg.seenBy });
            }
        }
    });

    socket.on('add-reaction', ({ messageId, reaction, name }) => {
        const msg = messagesHistory.find((m) => m.id === messageId);
        if (msg && msg.type !== 'system' && msg.type !== 'deleted') {
            if (!msg.reactions) msg.reactions = {};
            if (msg.reactions[name] === reaction) {
                delete msg.reactions[name];
            } else {
                msg.reactions[name] = reaction;
            }
            io.emit('update-reaction', { messageId, reactions: msg.reactions });
        }
    });

    socket.on('change-group-name', (name) => {
        groupName = name;
        io.emit('update-group-name', groupName);
    });

    socket.on('typing', (name) => {
        socket.broadcast.emit('typing', name);
    });

    socket.on('recording', (name) => {
        socket.broadcast.emit('recording', name);
    });

    socket.on('stop-activity', () => {
        socket.broadcast.emit('stop-activity');
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            const leaveMsg = {
                id: 'sys_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                type: 'system',
                content: `${socket.username} ने चैट छोड़ दी है।`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            messagesHistory.push(leaveMsg);
            if (messagesHistory.length > 250) messagesHistory.shift();
            io.emit('chat-message', leaveMsg);
        }
        delete connectedUsers[socket.id];
        io.emit('update-users-list', Object.values(connectedUsers));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
