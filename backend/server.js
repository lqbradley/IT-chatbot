const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

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

// All other GET requests not handled before will return the React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

let intents = {};
fs.readFile('intents.json', 'utf8', (err, data) => {
    if (err) throw err;
    intents = JSON.parse(data.toString());
});

const userSessions = {};

io.on('connection', (socket) => {
    const userId = socket.id;
    console.log(`New client connected: ${userId}`);
    userSessions[userId] = { stage: 0, failCount: 0 };
    socket.emit('message', { userId, type: 'bot', name: 'System', text: 'Welcome! I am a restaurant suggestion bot. I can give you advice and information about restaurants in town. Firstly, which cuisine would you like to have? (Italian, Chinese, Mexican, Japanese, Indian, or Fast Food). During using this chatbot, you can enter "main menu" at any step to back to cuisine selection step.' });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${userId}`);
        delete userSessions[userId];
        socket.removeAllListeners(); 
    });

    socket.on('userMessage', (data) => {
        console.log(`Received message from ${userId}: ${data.message}`);
        const response = determineResponse(data.message, userId);
        console.log(`Sending response to ${userId}: ${response}`);
        socket.emit('message', { userId, type: 'bot', name: 'System', text: response });
    });
});

function determineResponse(message, userId) {
    const session = userSessions[userId];
    const lowerCaseMessage = message.toLowerCase();
    const words = lowerCaseMessage.split(/\s+/);
    let response = ""; // Initialize as an empty string
    let understood = false;

    // Universal conditions
    if (lowerCaseMessage.includes("main menu")) {
        session.stage = 0;
        session.failCount = 0;
        response = "Okay, let's start over. Which cuisine would you like to have?";
        understood = true;
        return response;
    } else if (lowerCaseMessage.includes("go back")) {
        session.stage = Math.max(0, session.stage - 1);
        session.failCount = 0;
        response = "Okay, going back to the previous step.";
        understood = true;
    }

    if (session.stage === 0) {
        const cuisines = words.filter(word => intents[word]);
        if (cuisines.length > 0) {
            session.cuisines = cuisines;
            session.stage = 1;
            session.failCount = 0;
            const restaurantNames = cuisines.map(cuisine => 
                intents[cuisine].restaurants.map(r => r.name).join(", ")
            ).join(" | ");
            response = `There are several restaurants in the selected cuisines: ${restaurantNames}. Which one would you like to know more about? Or you can use 'go back' or 'main menu' to reselect the cuisine.`;
            understood = true;
        } else {
            response = "Please tell me which cuisine you are interested in.";
        }
    } else if (session.stage === 1) {
        const selectedRestaurants = [];
        session.cuisines.forEach(cuisine => {
            const restaurant = intents[cuisine].restaurants.find(r => r.name.toLowerCase().includes(lowerCaseMessage));
            if (restaurant) {
                selectedRestaurants.push(restaurant);
            }
        });
        if (selectedRestaurants.length > 0) {
            session.restaurants = selectedRestaurants;
            session.stage = 2;
            session.failCount = 0;
            response = `You selected ${selectedRestaurants.map(r => r.name).join(", ")}. What would you like to know about them? (price range, location, rating, opening hours, parking) Or use 'go back' to last step.`;
            understood = true;
        } else {
            response = "Please select a restaurant from the list or say 'go back' to choose another cuisine.";
        }
    } else if (session.stage === 2) {
        session.restaurants.forEach(restaurant => {
            if (lowerCaseMessage.includes("price")) {
                response += `The price range for ${restaurant.name} is ${restaurant.price_range}. `;
                understood = true;
            } else if (lowerCaseMessage.includes("location")) {
                response += `${restaurant.name} is located at ${restaurant.location}. `;
                understood = true;
            } else if (lowerCaseMessage.includes("rating")) {
                response += `${restaurant.name} has a rating of ${restaurant.rating}. `;
                understood = true;
            } else if (lowerCaseMessage.includes("hours") || lowerCaseMessage.includes("opening")) {
                response += `${restaurant.name} is open from ${restaurant.opening_hours}. `;
                understood = true;
            } else if (lowerCaseMessage.includes("parking")) {
                response += `Parking for ${restaurant.name} is ${restaurant.parking}. `;
                understood = true;
            }
        });
        if (lowerCaseMessage.includes("nothing else") || lowerCaseMessage.includes("satisfied")||lowerCaseMessage.includes("ok")||lowerCaseMessage.includes("good")) {
            session.stage = 3;
            session.failCount = 0;
            response += `Great! If you're satisfied with ${session.restaurants.map(r => r.name).join(", ")}, I can assist you with making a reservation. Would you like to proceed with a reservation?`;
            understood = true;
        }

        // If no understood response was formed, provide the default message
        if (!understood) {
            response += "I'm sorry, I didn't understand that. Please ask about price range, location, rating, opening hours, parking, or say 'go back to restaurants' or 'main menu to cuisines reselct'.";
        }
    } else if (session.stage === 3) {
        if (lowerCaseMessage.includes("yes") || lowerCaseMessage.includes("please")|| lowerCaseMessage.includes("good")|| lowerCaseMessage.includes("great")) {
            session.stage = 4;
            session.failCount = 0;
            response = "Excellent! How many people is the reservation for?";
            understood = true;
        } else {
            response = "Okay, if you need any more information, just let me know!";
        }
    } else if (session.stage === 4) {
        const people = parseInt(lowerCaseMessage);
        if (!isNaN(people) && people > 0) {
            session.reservation = { people };
            session.stage = 5;
            response = "Great! What time today would you like to make the reservation for? (Please use 24-hour format, e.g., 18:30)";
            understood = true;
        } else {
            response = "Please specify a valid number of people for the reservation.";
        }
    } else if (session.stage === 5) {
        if (lowerCaseMessage.match(/^([01]\d|2[0-3]):([0-5]\d)$/)) {
            session.reservation.time = lowerCaseMessage;
            session.stage = 6;
            response = "Got it! Do you have any allergies or dietary restrictions we should be aware of?";
            understood = true;
        } else {
            response = "Please provide a valid time for the reservation in 24-hour format (e.g., 18:30).";
        }
    } else if (session.stage === 6) {
        session.reservation.allergies = lowerCaseMessage;
        response = `Excellent! Your reservation information is stored. Details:\nNumber of people: ${session.reservation.people}\nTime: ${session.reservation.time}\nAllergies: ${session.reservation.allergies} if you want to preceed to reservation request to the selected restaurant, please enter "ok". For any alternation, please use "go back" to back to last step.`;

        // Save the reservation to a file
        fs.writeFile('reservations.json', JSON.stringify(session.reservation, null, 2), (err) => {
            if (err) {
                console.error('Error writing reservation to file:', err);
            } else {
                console.log('Reservation information saved successfully.');
            }
        });

        session.stage = 0; // Reset session stage after reservation
        understood = true;
    } else if (session.stage === 7) {
        if (lowerCaseMessage.includes("thank you") || lowerCaseMessage.includes("great") || lowerCaseMessage.includes("good") || lowerCaseMessage.includes("thanks")|| lowerCaseMessage.includes("ok")) {
            session.stage = 0;
            response = 'Your reservation request have been sent to the selected restaurant, want else do you want to know? Or enter "main menu" to quit current session.';
            understood = true;
        } else if (lowerCaseMessage.includes("bye")) {
            session.stage = 0;
            response = "Bye! If you have any other questions, just ask. Which cuisine would you like to have?";
            understood = true;
        }
    }

    if (!understood) {
        session.failCount++;
        if (session.failCount >= 3) {
            session.stage = 0;
            session.failCount = 0;
            response = "It seems I'm having trouble understanding you. Let's start over. Which cuisine would you like to have?";
        } else {
            response = "I'm sorry, I didn't understand that. Could you please rephrase?";
        }
    }

    return response;
}

const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`Listening on port ${port}`));
