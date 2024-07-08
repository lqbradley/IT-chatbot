const express = require('express');
const https = require('https');
const socketIo = require('socket.io');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const app = express();

const privateKey = fs.readFileSync(path.join(__dirname, 'certificates', 'chatbotrestaurant.key'), 'utf8');
const certificate = fs.readFileSync(path.join(__dirname, 'certificates', 'chatbotrestaurant.crt'), 'utf8');



const credentials = {
    key: privateKey,
    cert: certificate
};

const httpsServer = https.createServer(credentials, app);
const io = socketIo(httpsServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const determineRestaurant = require("./determineRestaurant");

app.use(cors());

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Logging middleware to debug requests
app.use((req, res, next) => {
    console.log(`Received request for ${req.url}`);
    next();
});

// API route to handle other requests (for future API endpoints)
app.get('/api', (req, res) => {
    res.send('API is running...');
});

// All other GET requests not handled before will return the React
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

const userSessions = {};

io.on('connection', (socket) => {
    const userId = socket.id;
    console.log(`New client connected: ${userId}`);
    userSessions[userId] = { stage: 0, failCount: 0 };
    socket.emit('message', {
        userId,
        type: 'bot',
        name: 'System',
        text: `Welcome! I am a restaurant suggestion bot. I can give you advice and make reservations for restaurants in ExampleTown.
            Firstly, which cuisine would you like to have? (Italian, Chinese, Mexican, Japanese, Indian, American or Korean).
            At any point in this conversation, you can enter "main menu" to start over.`
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${userId}`);
        delete userSessions[userId];
        socket.removeAllListeners();
    });

    socket.on('userMessage', async (data) => {
        console.log(`Received message from ${userId}: ${data.message}`);
        const response = await handleMessage(data.message, userId);
        console.log(`Sending response to ${userId}: ${response}`);
        socket.emit('message', { userId, type: 'bot', name: 'System', text: response });
    });
});

async function handleMessage(message, sessionId) {
    if (!userSessions[sessionId]) {
        userSessions[sessionId] = { history: [], stage: 0, failCount: 0, restaurantChoices: [], additionalRequirement: '', chosenRestaurant: '', restaurantData: {}, reservation: {} };
    }
    let session = userSessions[sessionId];
    let prevRestaurantChoices = session.restaurantChoices;

    try {
        let response = await determineRestaurant(message, session, prevRestaurantChoices);

        if (Array.isArray(session.history)) {
            session.history.push({ message, response });
        } else {
            session.history = [{ message, response }]; // Initialize it if it's not an array
        }

        return response;
    } catch (error) {
        console.error(`Error in handleMessage: ${error}`);
        return 'Sorry, something went wrong. Please try again.';
    }
}

const port = process.env.PORT || 4000;
httpsServer.listen(port, () => console.log(`Listening on port ${port}`));
