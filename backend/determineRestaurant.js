const fs = require("fs").promises;


async function getUniqueVals(restaurants) {
    const uniqueKeys = ["ambiance", "cuisine", "payment_accepted",
        "view", "sustainability_rating", "menu_highlights"];

    let uniqueValues = {};

    for (let key of uniqueKeys) {
        let vals = restaurants.map(element => {
            if (Array.isArray(element[key])) {
                return element[key];
            } else {
                return [element[key]];
            }
        }).flat();
        uniqueValues[key] = [...new Set(vals)];
    }

    return uniqueValues;
}

async function determineRestaurant(message, session, restaurantData, prevRestaurantChoices) {

    const lowerCaseMessage = message.toLowerCase();
    const words = lowerCaseMessage.split(/\s+/);
    let response; // Initialize as an empty string
    let understood = false;


    if (!Array.isArray(session.history)) {
        session.history = [];
    }


    let intents;
    let restaurants = [];
    let uniqueVals = {};
    try {
        const intentsData = await fs.readFile('intents.json', 'utf8');
        intents = JSON.parse(intentsData);

        const restaurantsData = await fs.readFile('restaurants.json', 'utf8');
        restaurants = JSON.parse(restaurantsData);

        uniqueVals = await getUniqueVals(restaurants);
    } catch (err) {
        console.error('Error reading files:', err);
        return 'There was an error processing your request. Please try again later.';
    }



    // set variables used to determine restaurant
    let intent = getIntentFromMessage(lowerCaseMessage, intents);
    console.log(`Intent:${intent}`)

    // find all possible values for ambiances, payment methods, etc. (i.e. anything that isn't stored as binary true or false)
    // easier to add additional values without rewriting the code

    function checkSkip (criteria, restaurantData) {
        if (restaurantData[criteria] === null) {
            session.stage ++;
            console.log(restaurantData[criteria])
            return true
        }
        return false
    }

    // enable go back function to the app
    if (intent === "main") {
        session.stage = 0;
        session.failCount = 0;
        response = "Okay, let's start over. Firstly, which cuisine would you like to have? (Italian, Chinese, Mexican, Japanese, Indian, American, or Korean)";
    } else if (intent === "back") {
        session.stage = Math.max(0, session.stage - 1);
        session.failCount = 0;
        response = "Okay, going back to the previous step.";
        understood = true;
    }


    // handle case where conversation has gone on for a while
    if (session.conversationIsLong){
        if (intent === "continue"){
            let lastEntry = session.history[session.history.length - 1];
            const previousMessage = lastEntry.response
            response += `Great! Let's continue where we left off \n ${previousMessage}`;
            session.stage = Math.max(0, session.stage - 1);
            session.failCount = 0;
            understood = true;
        } else if (intent === "bye") {
            session.stage = 0;
            session.failCount = 0;
            understood = true;
            response = "Okay, let's start over. Firstly, which cuisine would you like to have? (Italian, Chinese, Mexican, Japanese, Indian, American, or Korean).";
        }
    } else if (!session.conversationIsLong) {
        console.log(`Current failcount is ${session.failCount}`)
        console.log(`Current Stage is ${session.stage}`)
        switch (session.stage) {
            case 0:
                if (!checkSkip("cuisine", restaurantData)) {
                    const cuisineChoices = uniqueVals.cuisine
                    const cuisines = words.filter(word => cuisineChoices.includes(word));
                    session.cuisines = cuisines;
                    if (cuisines.length > 0) {
                        session.stage = 1;
                        session.failCount = 0;
                        response = "What rating would you like the restaurant to have?"; // empty becasue welcome message has already been sent
                        understood = true;
                    }
                }
                break;
            case 1:
                // handle rating
                if (!checkSkip("rating", restaurantData)) {
                    const rating = parseFloat(message);
                    if (!isNaN(rating) && rating > 0 && rating <= 5) {
                        restaurantData.rating = rating;
                        session.stage = 2;
                        session.failCount = 0;
                        response = "Perfect! What price range are you looking for? (e.g., $, $$, $$$)"
                        understood = true;
                    } else if (intent === "no_preference") {
                        session.stage = 5;
                        session.failCount = 0;
                        response = "Perfect! What price range are you looking for? (e.g., $, $$, $$$)";
                        understood = true;
                    }
                }
                break;
            case 2:
                // Handle price selection
                if (!checkSkip("price_range", restaurantData)) {
                    if (["$", "$$", "$$$"].includes(intent)) {
                        restaurantData.price_range = intent
                        session.stage = 3;
                        response = "What ambiance are you looking for? (e.g., cozy, formal, casual)";
                        understood = true;
                    }
                }
                break;

            case 3:
                // handle ambiance choices
                if (!checkSkip("ambiance", restaurantData)) {
                    const ambianceChoices = uniqueVals.ambiance
                    const ambiance = words.filter(word => ambianceChoices.includes(word));
                    if (ambiance.length > 0) {
                        restaurantData.ambiance = ambiance
                        // only note requirements if ambiance exists, otherwise ignore
                    }
                    session.stage = 4;
                    session.failCount = 0;
                    response = response = "We can make that happen! Would you need a place with wifi? (yes/no)";
                    understood = true;
                }
                break;

            case 4:
                // handle wifi requirement
                if (!checkSkip("wifi", restaurantData)) {
                    if (intent === "yes" ||
                        intent === "no") {
                        restaurantData.wifi = intent === "yes";
                    }
                    session.stage = 5;
                    session.failCount = 0;
                    response = "Do you require wheelchair accessibility? (yes/no)";
                    understood = true;
                }
                break;

            case 5:
                // handle accessibility requirement
                if (!checkSkip("wheelchair_accessible", restaurantData)) {
                    if (intent === "yes" ||
                        intent === "no") {
                        restaurantData.wheelchair_accessible = intent === "yes";
                        session.stage = 6;
                        session.failCount = 0;
                        response = "Do you require vegan/vegetarian options? (vegan/vegetarian/no preference)";
                        understood = true;
                    }
                }
                break;

            case 6:
                // need to check this
                if ((!checkSkip("vegan_options", restaurantData)) ||
                    (!checkSkip("vegetarian_options", restaurantData))) {
                    const dietaryOptions = ["vegan", "vegetarian"]
                    if (dietaryOptions.includes(intent)) {
                        restaurantData.vegan_options = intent === "vegan";
                        restaurantData.vegetarian_options = intent === "vegetarian" || intent === "vegan";
                        session.stage = 7;
                        session.failCount = 0;
                        response = "Do you prefer indoor seating, outdoor seating, both or no preference?";
                        understood = true;
                    } else if (intent === "no_preference") {
                        session.stage = 7;
                        session.failCount = 0;
                        response = "Do you prefer indoor seating, outdoor seating, both or no preference?";
                        understood = true;
                    }
                }
                break;
            case 7:
                if (!checkSkip("cuisine", restaurantData)) {
                    // handle seating preference
                    const seatingPreferences = ["indoor", "outdoor", "both"];
                    const seatChoice = intent
                    if (seatingPreferences.includes(seatChoice)) {
                        restaurantData.indoor_seating = seatChoice === "indoor" || seatChoice === "both";
                        restaurantData.outdoor_seating = seatChoice === "outdoor" || seatChoice === "both";
                    }
                    session.stage = 8;
                    session.failCount = 0;
                    response = "Would you prefer if the place had a bar or a lounge? (bar/lounge/no preference/neither)";
                    understood = true;
                }
                break;
            case 8:
                const drinkingOptions = ["bar", "lounge"]
                if (drinkingOptions.includes(intent)) {
                    restaurantData.lounge_included = intent === "lounge";
                    restaurantData.bar_included = intent === "lounge" || intent === "bar"
                    session.stage = 9;
                    session.failCount = 0;
                    response = "Would you prefer a place with some entertainment? (live music/ football/ no preference / neither)";
                    understood = true;
                } else if (intent === "no_preference") {
                    session.stage = 9;
                    session.failCount = 0;
                    response = "Would you prefer a place with some entertainment? (live music/ football/ no preference / neither)";
                    understood = true;
                } else if (intent === "no") {
                    restaurantData.bar_included = restaurantData.lounge_included = false;
                    session.stage = 9;
                    session.failCount = 0;
                    response = response = "Would you prefer a place with some entertainment? (live music/ football/ no preference / neither)";
                    understood = true;
                }
                break;
            case 9:
                const entertainmentOptions = ["live_music", "football"]
                const entertain = intent
                if (entertainmentOptions.includes(entertain)) {
                    restaurantData.live_music = entertain === "live_music";
                    restaurantData.football_watching = entertain === "football";
                    session.stage = 10;
                    session.failCount = 0;
                    response = "Do you have a preference on payment methods? (e.g. card/cash/crypto etc. or no preference)";
                    understood = true;
                } else if (entertain === "no_preference") {
                    session.stage = 10;
                    session.failCount = 0;
                    response = "Do you have a preference on payment methods? (e.g. card/cash/crypto etc. or no preference)";
                    understood = true;
                } else if (entertain === "no") {
                    restaurantData.live_music = restaurantData.football_watching = false;
                    session.stage = 10;
                    session.failCount = 0;
                    response = "Do you have a preference on payment methods? (e.g. card/cash/crypto etc. or no preference)";
                    understood = true;
                }
                break;
            case 10:
                if (!checkSkip("payment_accepted", restaurantData)) {
                    const paymentChoices = uniqueVals.payment_accepted
                    const payment = words.filter(word => paymentChoices.includes(word));
                    if (payment.length > 0) {
                        restaurantData.payment_accepted = payment
                        session.stage = 11;
                        session.failCount = 0;
                        response = "Sounds good! Is there a certain view during dining you would like to have? (e.g. sea, city, garden)";
                        understood = true;
                    } else if (intent === "no_preference") {
                        session.stage = 11;
                        session.failCount = 0;
                        response = "Is there a certain view during dining you would like to have? (e.g. sea, city, garden)";
                        understood = true;
                    }

                }
                break;
            case 11:
                if (!checkSkip("view", restaurantData)) {
                    const viewChoices = uniqueVals.view
                    const view = words.filter(word => viewChoices.includes(word));
                    if (view.length > 0) {
                        restaurantData.view = view
                        // only note requirements if specified view exists, otherwise ignore
                    }
                    session.stage = 12;
                    session.failCount = 0;
                    response = "Sounds good! Do you have any specific sustainability ratings? (A/B/C or no preference";
                    understood = true;
                }
                break;
            case 12:
                if (!checkSkip("sustainability_rating", restaurantData)) {
                    const sustainabilityRatings = uniqueVals.sustainability_rating
                    if (sustainabilityRatings.includes(message)) {
                        restaurantData.sustainability_rating = message;
                        session.stage = 13;
                        session.failCount = 0;
                        response = "Is there a certain dish you would like to try? (yes/no)";
                        understood = true;
                    } else if (intent === "no_preference") {
                        session.stage = 13;
                        session.failCount = 0;
                        response = "Is there a certain dish you would like to try? (yes/no) ";
                        understood = true;
                    }
                }
                break;
            case 13:
                if (intent === "yes") {
                    session.stage = 14;
                    session.failCount = 0;
                    response = "Please enter the name of dish you would like to try"
                    understood = true
                } else if (intent === "no") {
                    session.stage = 15;
                    session.failCount = 0;
                    response = `No worries. Are there any additional requirements that are important for you to find out? (parking / catering / dog-friendly / kid-friendly, etc.)
                                Please answer with yes or no. The requirement can be specified in the following question`;
                    understood = true;
                }
                break;
            case 14:
                const possibleDishes = uniqueVals.menu_highlights
                const choice = possibleDishes.filter(word => message.includes(word));
                if (choice) {
                    restaurantData.menu_highlights = choice
                } else {
                    restaurantData.menu_highlights = message
                }
                response = `Sounds good! Are there any additional requirements that are important for you to find out? (parking / catering / dog-friendly / kid-friendly, etc.)
                            Please respond with yes or no. The specific requirement can be provided in the following question`;
                understood = true;
                session.stage = 15;
                session.failCount = 0;
                break;
            case 15:
                if (intent === "yes") {
                    session.stage = 16;
                    session.failCount = 0;
                    response = "Please enter the requirement that needs to be satisfied"
                    understood = true
                } else if (intent === "no") {
                    session.stage = 18;
                    session.failCount = 0;
                    response = `Sounds good. Here is a list of the specified requirements \n ${JSON.stringify(restaurantData)}  \n Did I get everything right?`;
                    understood = true;
                } else {
                    response = "Please respond with yes or no. The specific requirement can be inputted after";
                    session.failCount++;
                }
                break;
            case 16:
                if (intent === "catering" || intent === "parking" || intent === "kid_friendly" || intent === "dog-friendly") {
                    session.stage = 17;
                    session.failCount = 0;
                    response = `Would you like a place with ${intent}? (yes/no)`
                    understood = true;
                } else if (intent) {
                    session.stage = 17
                    session.failCount = 0;
                    response = "Unfortunately we cannot accommodate your request at this time. Is there an additional requirement you would like to check for?"
                    understood = true
                } else if (intent === "no") {
                    session.stage = 18
                    session.failcount = 0;
                    response = `Sounds good. Here is a list of the specified requirements ${restaurantData} Did I get everything right?`;
                    understood = true;
                }
                break;
            case 17:
                if (intent === "yes" ||
                    intent === "no") {
                    restaurantData[intent] = intent === "yes";
                }
                session.stage = 18;
                session.failCount = 0;
                response = `Sounds good! Are there any additional requirements that are important for you to find out? (parking / catering / none)
                        Please respond with one of the options listed. The specific requirement can be provided in the following question`;
                understood = true;
                break;
            case 18:
                if (intent === "yes") {
                    let selectedRestaurants = getRestaurants(restaurantData, restaurants)
                    selectedRestaurants = session.restaurantChoices = [...selectedRestaurants, ...prevRestaurantChoices];
                    let restaurantNames = selectedRestaurants.map(r => r.name)
                    if (selectedRestaurants.length > 0) {
                        response = `No problem. Here is a list of restaurants that meet your criteria.
                                ${JSON.stringify(restaurantNames)} 
                               Would you like to proceed with a reservation with one of them?`
                        session.stage = 20;
                        session.failCount = 0;
                        understood = true;
                    } else {
                        response = "It looks like there are no restaurants that meet your requirements at this time. \n Please list the criteria you would like to change";
                        session.stage = 19;
                        session.failCount = 0;
                        understood = true;
                    }
                } else if (intent === "no") {
                    response = "Please list the criteria you would like to be changed"
                    session.stage = 19;
                    session.failCount = 0;
                    understood = true;
                }
                break;
            case 19: // needs
                const existingCriteria = Object.keys(restaurantData);
                if (existingCriteria.includes(intent)) {
                    restaurantData[intent] = null;
                    session.stage = 0; // iterate through loop to determine which attribute needs to be changed
                    response = "Sure thing";
                    understood = true


                } else {
                    response = "Looks like we cannot satisfy that criteria at this time. Would you like "
                }


                break;
            case 20:
                // handle reservation
                if (intent === "yes") {
                    session.stage = 22;
                    session.failCount = 0;
                    response = "Excellent! How many people is the reservation for?";
                    understood = true;
                } else if (intent === "no") {
                    session.stage = 21;
                    session.failCount = 0;
                    response = "No problem. Would you like to search for an alternative restaurant?";  // if not, reset
                    understood = true;
                }
                break;
            case 21:
                // go back to the beginning to search for alternative restaurants
                if (intent === "yes") {
                    prevRestaurantChoices = session.restaurantChoices // store existing restaurant in variable
                    restaurantData = {}
                    session.stage = 0;
                    session.failCount = 0;
                    understood = true;
                } else {
                    session.stage = 0;
                    response = "Bye! If you have any other questions, just ask. Which cuisine would you like to have? (Italian, Chinese, Mexican, Japanese, Indian, or American)";
                    understood = true;
                }
                break;
            case 22:
                // handle number of people
                const people = parseInt(lowerCaseMessage);
                if (!isNaN(people) && people > 0) {
                    session.reservation = {people};
                    session.stage = 23;
                    response = "Great! What time today would you like to make the reservation for? (Please use 24-hour format, e.g., 18:30)";
                    understood = true;
                } else {
                    response = "Please specify a valid number of people for the reservation.";
                }
                break;
            case 23:
                const timeMatch = lowerCaseMessage.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
                if (timeMatch) {
                    const reservationTime = `${timeMatch[1]}:${timeMatch[2]}`;
                    const restaurant = session.restaurantChoices[0]; //chooses first one to make a reservation for

                    if (isTimeWithinOpeningHours(reservationTime, restaurant.opening_hours)) {
                        session.reservation.time = reservationTime;
                        session.stage = 24;
                        response = "Got it! Do you have any allergies or dietary restrictions we should be aware of?";
                        understood = true;
                    } else {
                        response = `Sorry, please enter a valid time within the opening hours (${restaurant.opening_hours}). Or you can use 'go back' to check the opening hours again.`;
                    }
                }
                break;
            case 24:
                session.reservation.allergies = lowerCaseMessage;
                session.stage = 25;
                response = "Thank you! Can I have your name for the reservation?";
                understood = true;
                break;
            case 25:
                session.reservation.name = message;
                response = `Excellent! Your reservation information is stored. Details:\nName: ${session.reservation.name}\nNumber of people: ${session.reservation.people}\nTime: ${session.reservation.time}\nAllergies: ${session.reservation.allergies}. Would you like to send the reservation information to selected restaurant to confirm reservation? (yes/no)`;
                // Save the reservation to the json file
                fs.writeFile('reservations.json', JSON.stringify(session.reservation, null, 2), (err) => {
                    if (err) {
                        console.error('Error writing reservation to file:', err);
                    } else {
                        console.log('Reservation information saved successfully.');
                    }
                });
                session.stage = 26;
                understood = true;
                break;
            case 26:
                if (intent === "yes") {
                    session.stage = 21;
                    response = 'Your reservation request have been sent to the selected restaurant, would you like to search for another restaurant or start over?';
                    understood = true;
                } else if (intent === "bye") {
                    session.stage = 0;
                    response = "Bye! If you have any other questions, just ask. Which cuisine would you like to have? (Italian, Chinese, Mexican, Japanese, Indian, or American)";
                    understood = true;
                }
        }

        // push message of previous stage if not understood
        if (!understood) {
            session.failCount++;
            if (session.failCount >= 3) {
                session.stage = 0;
                session.failCount = 0;
                response = "It seems I'm having trouble understanding you. Let's start over. Which cuisine would you like to have? (Italian, Chinese, Mexican, Japanese, Indian, or American)";
                session.history = [{message: response, type: 'system'}];
            } else {
                if (session.failCount === 1) {
                    console.log(session.stage)
                    response = "I'm sorry, I didn't understand that. Could you please rephrase?";
                    if (session.history.length > 0) {
                        let lastEntry = session.history[session.history.length - 1];
                        const previousMessage = lastEntry.response
                        response += `\n ${previousMessage}`;
                        console.log(session.stage)
                    }
                } else if (session.failCount === 2) {
                    if (session.history.length > 0) {
                        let lastEntry = session.history[session.history.length - 1];
                        const previousMessage = lastEntry.response
                        response = previousMessage;
                        console.log(previousMessage)
                    }
                }
            }
        }
    }


    console.log(`Response: ${response}`)
    return response;
}

function isTimeWithinOpeningHours(time, openingHours) {
    const [opening, closing] = openingHours.split(' - ');
    return time >= opening && time <= closing;
}

function getIntentFromMessage(message, intents) {
    for (let intent in intents) {
        const patterns = intents[intent];
        for (let pattern of patterns) {
            if (message.includes(pattern)) {
                return intent;
            }
        }
    }
    return "fallback";
}


function getRestaurants(requirementDict, restaurants) {
    return restaurants.filter((item) => {
        return Object.keys(requirementDict).every(key => {
            return item[key] === requirementDict[key];
        });
    });
}


module.exports = determineRestaurant;
