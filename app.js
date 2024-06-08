const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let intents = {};
fs.readFile('intents.json', (err, data) => {
    if (err) throw err;
    intents = JSON.parse(data.toString());
});

io.on('connection', (socket) => {
    socket.on('message', (data) => {
        const response = determineResponse(data.message);
        socket.emit('response', { message: response });
    });
});

function determineResponse(message) {
    const words = message.split(" ");
    for (let word of words) {
        if (intents[word.toLowerCase()]) {
            return intents[word.toLowerCase()];
        }
    }
    return "Sorry, I'm not sure how to help with that.";
}

const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`Listening on port ${port}`));
