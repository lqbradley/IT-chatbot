const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const cors = require('cors');
const path = require('path');


const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});
const determineRestaurant = require( "./determineRestaurant");

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
    socket.emit('message', { userId, type: 'bot', name: 'System', text: `Welcome! I am a restaurant suggestion bot. I can give you advice and make reservations for restaurants in ExampleTown.
            Firstly, which cuisine would you like to have? (Italian, Chinese, Mexican, Japanese, Indian, American or Korean). 
            At any point in this conversation, you can enter "main menu" to start over. ` });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${userId}`);
        delete userSessions[userId];
        socket.removeAllListeners(); 
    });

    socket.on('userMessage', async (data) => {
        console.log(`Received message from ${userId}: ${data.message}`);
        const response = await handleMessage(data.message, userId);
        console.log(`Sending response to ${userId}: ${response}`);
        socket.emit('message', {userId, type: 'bot', name: 'System', text: response});
    });
});

async function handleMessage(message, sessionId) {

    if (!userSessions[sessionId]) {
        userSessions[sessionId] = {history: [],  stage: 0, failCount: 0, restaurantChoices: [], conversationIsLong: false};
    }
    let session = userSessions[sessionId];
    let restaurantData = {};
    let prevRestaurantChoices = []

    console.log(`Session details: ${JSON.stringify(session)}`);

    try {
        let response = await determineRestaurant(message, session, restaurantData, prevRestaurantChoices);

        if (Array.isArray(session.history)) {
            session.history.push({ message, response });
        } else {
            session.history = [{ message, response }]; // Initialize it if it's not an array
        }

        // If chatting for too long, offer user possibility to continue
        if (session.history.length > 50) {
            session.conversationIsLong = true;
            response = response + " We've been chatting for a while. Would you like to continue or start over?";
        }

        console.log(`Response: ${response}`);
        return response;
    } catch (error) {
        console.error(`Error in handleMessage: ${error}`);
        return 'Sorry, something went wrong. Please try again.';
    }


}



const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`Listening on port ${port}`));

