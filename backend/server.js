const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Allow all origins for testing, change to your specific domain in production
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
    socket.emit('message', { userId, type: 'bot', name: 'System', text: "Welcome! I am a restaurant suggestion bot. I can give you advice and information about restaurants in town. Firstly, which cuisine would you like to have? (Italian, Chinese, Mexican, Japanese, Indian, or Fast Food)" });

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
    const words = message.toLowerCase().split(/\s+/);
    let response = ""; // Initialize as an empty string
    let understood = false;

    if (session.stage === 0) {
        const cuisines = words.filter(word => intents[word]);
        if (cuisines.length > 0) {
            session.cuisines = cuisines;
            session.stage = 1;
            session.failCount = 0;
            const restaurantNames = cuisines.map(cuisine => 
                intents[cuisine].restaurants.map(r => r.name).join(", ")
            ).join(" | ");
            response = `There are several restaurants in the selected cuisines: ${restaurantNames}. Which one would you like to know more about? Or you can use go back or main menu to reselect the cuisine`;
            understood = true;
        } else {
            response = "Please tell me which cuisine you are interested in.";
        }
    } else if (session.stage === 1) {
        if (message.includes("go back") || message.includes("main menu") || message.includes("new cuisine") || message.includes("last step")) {
            session.stage = 0;
            response = "Okay, let's start over. Which cuisine would you like to have?";
            understood = true;
        } else {
            const selectedRestaurants = [];
            session.cuisines.forEach(cuisine => {
                const restaurant = intents[cuisine].restaurants.find(r => r.name.toLowerCase().includes(message.toLowerCase()));
                if (restaurant) {
                    selectedRestaurants.push(restaurant);
                }
            });
            if (selectedRestaurants.length > 0) {
                session.restaurants = selectedRestaurants;
                session.stage = 2;
                session.failCount = 0;
                response = `You selected ${selectedRestaurants.map(r => r.name).join(", ")}. What would you like to know about them? (price range, location, rating, opening hours, parking)`;
                understood = true;
            } else {
                response = "Please select a restaurant from the list or say 'go back' to choose another cuisine.";
            }
        }
    } else if (session.stage === 2) {
        if (message.includes("go back to restaurants") || message.includes("restaurants")|| message.includes("restaurant")|| message.includes("other restaurant")|| message.includes("new one")) {
            session.stage = 1;
            const restaurantNames = session.cuisines.map(cuisine => 
                intents[cuisine].restaurants.map(r => r.name).join(", ")
            ).join(" | ");
            response = `Okay, let's go back. There are several restaurants in the selected cuisines: ${restaurantNames}. Which one would you like to know more about?`;
            understood = true;
        } else if (message.includes("go back to cuisines") || message.includes("main menu") || message.includes("another cuisine")|| message.includes("new cuisine")) {
            session.stage = 0;
            response = "Okay, let's go back. Which cuisine would you like to have?";
            understood = true;
        } else {
            session.restaurants.forEach(restaurant => {
                if (message.includes("price")) {
                    response += `The price range for ${restaurant.name} is ${restaurant.price_range}. `;
                    understood = true;
                } else if (message.includes("location")) {
                    response += `${restaurant.name} is located at ${restaurant.location}. `;
                    understood = true;
                } else if (message.includes("rating")) {
                    response += `${restaurant.name} has a rating of ${restaurant.rating}. `;
                    understood = true;
                } else if (message.includes("hours") || message.includes("opening")) {
                    response += `${restaurant.name} is open from ${restaurant.opening_hours}. `;
                    understood = true;
                } else if (message.includes("parking")) {
                    response += `Parking for ${restaurant.name} is ${restaurant.parking}. `;
                    understood = true;
                }
            });
            if (message.includes("nothing else") || message.includes("satisfied")) {
                session.stage = 3;
                session.failCount = 0;
                response += `Great! If you're satisfied with ${session.restaurants.map(r => r.name).join(", ")}, I can assist you with making a reservation. Would you like to proceed with a reservation?`;
                understood = true;
            }
        }

        // If no understood response was formed, provide the default message
        if (!understood) {
            response += "I'm sorry, I didn't understand that. Please ask about price range, location, rating, opening hours, parking, or say 'go back to restaurants' or 'go back to cuisines'.";
        }
    } else if (session.stage === 3) {
        if (message.includes("yes") || message.includes("please")) {
            session.stage = 4;
            session.failCount = 0;
            response = "Excellent! How many people is the reservation for?";
            understood = true;
        } else if (message.includes("go back to cuisines") || message.includes("main menu") || message.includes("another cuisine")) {
            session.stage = 0;
            response = "Okay, let's go back. Which cuisine would you like to have?";
            understood = true;
        } else {
            response = "Okay, if you need any more information, just let me know!";
        }
    } else if (session.stage === 4) {
        const people = parseInt(message);
        if (!isNaN(people) && people > 0) {
            session.reservation = { people };
            session.stage = 5;
            response = "Great! What time would you like to make the reservation for?";
            understood = true;
        } else {
            response = "Please specify a valid number of people for the reservation.";
        }
    } else if (session.stage === 5) {
        if (message.match(/^\d{1,2}:\d{2}\s*(AM|PM|am|pm)?$/)) {
            session.reservation.time = message;
            session.stage = 6;
            response = "Got it! Do you have any allergies or dietary restrictions we should be aware of?";
            understood = true;
        } else {
            response = "Please provide a valid time for the reservation.";
        }
    } else if (session.stage === 6) {
        session.reservation.allergies = message;
        response = `Excellent! Your reservation information is stored. Details:\nNumber of people: ${session.reservation.people}\nTime: ${session.reservation.time}\nAllergies: ${session.reservation.allergies}`;

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
        if (message.includes("thank you") || message.includes("great") || message.includes("good") || message.includes("thanks")) {
            session.stage = 5;
            response = "You're welcome! Would you like to know more about other restaurants?";
            understood = true;
        } else if (message.includes("bye")) {
            session.stage = 5;
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
