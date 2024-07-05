const fs= require("fs").promises;



// find all possible values for ambiances, payment methods, etc. (i.e. anything that isn't stored as binary true or false)
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

async function determineRestaurant(message, session, prevRestaurantChoices) {

    const lowerCaseMessage = message.toLowerCase();
    const words = lowerCaseMessage.split(/\s+/);
    let response; // Initialize as an empty string
    let understood = false;


    if (!Array.isArray(session.history)) {
        session.history = [];
    }

    if (!session.restaurantData){
        session.restaurantData = {}
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


    // enable go back function to the app
    if (intent === "main") {
        session.stage = 0;
        session.failCount = 0;
        response = "Okay, let's start over. Firstly, which cuisine would you like to have? (Italian, Chinese, Mexican, Japanese, Indian, American, or Korean)";
        understood = true;
    }
    if (intent === "back") {
        session.stage = Math.max(0, session.stage - 1);
        session.failCount = 0;
        response = "Okay, going back to the previous step.";
        let lastEntry = session.history[session.history.length - 1];
        const previousMessage = lastEntry.response
        response += `\n ${previousMessage}`;
        understood = true;
    }
    if (intent === "fallback"){
        understood = false;
    }



       console.log(session.restaurantData)

        switch (session.stage) {
            case 0:
                    const cuisineChoices = uniqueVals.cuisine
                    const cuisines = words.filter(word => cuisineChoices.includes(word));
                    session.restaurantData.cuisine = cuisines;
                    if (cuisines.length > 0) {
                        session.stage = 1;
                        session.failCount = 0;
                        response = "What rating would you like the restaurant to have? (e.g. 3.5)";
                        understood = true;
                    }
                break;
            case 1:
                // handle rating
                    const rating = parseFloat(message);
                    if (!isNaN(rating) && rating > 0 && rating <= 5) {
                        session.restaurantData.rating = rating;
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
                break;
            case 2:
                // Handle price selection
                    if (["$", "$$", "$$$"].includes(intent)) {
                        session.restaurantData.price_range = intent
                        session.stage = 3;
                        response = "What ambiance are you looking for? (e.g., cozy, formal, casual or no preference)";
                        understood = true;
                    }
                break;

            case 3:
                // handle ambiance choices
                    const ambianceChoices = uniqueVals.ambiance
                    const ambiance = words.filter(word => ambianceChoices.includes(word));
                    if (ambiance.length > 0) {
                        session.restaurantData.ambiance = ambiance
                        session.stage = 4;
                        session.failCount = 0;
                        response = "We can make that happen! Would you need a place with wifi? (yes / no / no preference)";
                        understood = true;
                        // only note requirements if ambiance exists, otherwise ignore
                    } else if (intent === "no_preference" || lowerCaseMessage.length > 0) {
                        session.stage = 4;
                        session.failCount = 0;
                        response = "Would you need a place with wifi? (yes / no / no preference)";
                        understood = true;
                        // don't note anything if user doesn't care or gives an ambiance not in the list
                    }

                break;

            case 4:
                // handle wifi requirement
                    if (intent === "yes" ||
                        intent === "no") {
                        session.restaurantData.wifi = intent === "yes";
                    }
                    session.stage = 5;
                    session.failCount = 0;
                    response = "Do you require wheelchair accessibility? (yes/no)";
                    understood = true;
                break;

            case 5:
                // handle accessibility requirement
                    if (intent === "yes") {
                        session.restaurantData.wheelchair_accessible = true;
                        session.stage = 6;
                        session.failCount = 0;
                        response = "Do you require vegan/vegetarian options? (vegan/vegetarian/no preference)";
                        understood = true;
                    } else if (intent === "no"){
                        // if no wheelchair required, don't log criteria
                        session.stage = 6;
                        session.failCount = 0;
                        response = "Do you require vegan/vegetarian options? (vegan/vegetarian/no preference)";
                        understood = true;
                    }
                break;

            case 6:
                // need to check this
                    const dietaryOptions = ["vegan", "vegetarian"]
                    if (dietaryOptions.includes(intent)) {
                        session.restaurantData.vegan_options = intent === "vegan";
                        session.restaurantData.vegetarian_options = intent === "vegetarian" || intent === "vegan";
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
                break;
            case 7:
                    // handle seating preference
                    const seatingPreferences = ["indoor", "outdoor", "both"];
                    const seatChoice = intent
                    if (seatingPreferences.includes(seatChoice)) {
                        session.restaurantData.indoor_seating = seatChoice === "indoor" || seatChoice === "both";
                        session.restaurantData.outdoor_seating = seatChoice === "outdoor" || seatChoice === "both";
                    }
                    session.stage = 8;
                    session.failCount = 0;
                    response = "Would you prefer if the place had a bar or a lounge? (bar/lounge/no preference/neither)";
                    understood = true;
                break;
            case 8:
                const drinkingOptions = ["bar", "lounge"]
                if (drinkingOptions.includes(intent)) {
                    session.restaurantData.lounge_included = intent === "lounge";
                    session.restaurantData.bar_included = intent === "lounge" || intent === "bar"
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
                    session.restaurantData.bar_included = session.restaurantData.lounge_included = false;
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
                    session.restaurantData.live_music = entertain === "live_music";
                    session.restaurantData.football_watching = entertain === "football";
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
                    session.restaurantData.live_music = session.restaurantData.football_watching = false;
                    session.stage = 10;
                    session.failCount = 0;
                    response = "Do you have a preference on payment methods? (e.g. card/cash/crypto etc. or no preference)";
                    understood = true;
                }
                break;
            case 10:
                    const paymentChoices = uniqueVals.payment_accepted
                    const payment = words.filter(word => paymentChoices.includes(word));
                    if (payment.length > 0) {
                        session.restaurantData.payment_accepted = payment
                        session.stage = 11;
                        session.failCount = 0;
                        response = "Sounds good! Is there a certain view during dining you would like to have? (e.g. sea, city, garden or no preference)";
                        understood = true;
                    } else if (intent === "no_preference") {
                        session.stage = 11;
                        session.failCount = 0;
                        response = "Is there a certain view during dining you would like to have? (e.g. sea, city, garden or no preference)";
                        understood = true;
                    } else if (intent === "payment") {
                        session.stage = 11;
                        session.failCount = 0;
                        response = "Is there a certain view during dining you would like to have? (e.g. sea, city, garden or no preference)";
                        understood = true;
                    } else {
                        if (session.failCount === 0) {
                            // redo this step if user doesn't understand question
                            response = "Please provide a valid payment method";
                            session.stage = 10;
                            session.failCount = 0;
                            understood = true;
                        }
                    }

                break;
            case 11:
                    const viewChoices = uniqueVals.view
                    const view = words.filter(word => viewChoices.includes(word));
                    if (view.length > 0) {
                        session.restaurantData.view = view
                        session.stage = 12;
                        session.failCount = 0;
                        response = "Do you have any specific sustainability rating you would like? (A/B/C or no preference)"
                        understood = true;
                        // only note requirements if view exists, otherwise ignore
                    } else if (intent === "no_preference" || lowerCaseMessage.length > 0) {
                        session.stage = 12;
                        session.failCount = 0;
                        response = "Do you have any specific sustainability rating you would like? (A/B/C or no preference)"
                        understood = true;
                        // don't note anything if user doesn't care or gives a view not in the list
                    }
                break;
            case 12:
                    const sustainabilityRatings = uniqueVals.sustainability_rating
                    if (sustainabilityRatings.includes(message)) {
                        session.restaurantData.sustainability_rating = message;
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
                    session.restaurantData.menu_highlights = choice
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
                } else if (intent === "no") { // display restaurant list for user to choose from
                    let selectedRestaurants = getRestaurants(session.restaurantData, restaurants)
                    selectedRestaurants = session.restaurantChoices = [...selectedRestaurants, ...prevRestaurantChoices];
                    let restaurantNames = selectedRestaurants.map(r => r.name)
                    restaurantNames = restaurantNames.join(', ')
                    if (selectedRestaurants.length > 0) {
                        response = `Sounds good. Here is a list of restaurants that meet your requirements:
                                ${restaurantNames}.
                               Please choose one of them to proceed with a reservation`
                        session.stage = 18;
                        session.failCount = 0;
                        understood = true;
                    } else {
                        // if no restaurants exist, start over from the beginning
                        session.restaurantChoices = [{name: "The Classic Diner", opening_hours: "17:00 - 23:00"}]
                        response = `Sounds good. We recommend ${session.restaurantChoices[0].name}. Would you like to proceed with a reservation?`
                        session.stage = 19;
                        session.failCount = 0;
                        understood = true;
                    }
                } else {
                    if (session.failCount === 0) {
                        // redo this step if user doesn't understand question
                        response = "Please answer this question with yes or no";
                        session.stage = 15;
                        session.failCount = 0;
                        understood = true;
                    }
                }
                break;
            case 16:
                // checking if the requirment they want to set exists
                if (intent === "catering" || intent === "parking" || intent === "kid_friendly" || intent === "dog-friendly") {
                    session.stage = 17;
                    session.failCount = 0;
                    session.additionalRequirement = intent;
                    response = `Would you like a place with ${intent}? (yes/no)`
                    understood = true;
                } else if (intent) {
                    session.stage = 15
                    session.failCount = 0;
                    response = `Unfortunately we cannot accommodate your request at this time. Is there an additional requirement you would like to check for? (parking / catering / dog-friendly / kid-friendly, etc.)
                            Please respond with yes or no. The specific requirement can be provided in the following question\``
                    understood = true
                }
                break;
            case 17:
                // set requiremnt to true/false depending on their answer
                if (intent === "yes" ||
                    intent === "no") {
                    session.restaurantData[session.additionalRequirement] = intent === "yes";
                }
                session.stage = 15;
                session.failCount = 0;
                response = `Sounds good! Are there any additional requirements that are important for you to find out? (parking / catering / dog-friendly / kid-friendly, etc.)
                        Please respond with yes or no. The specific requirement can be provided in the following question`;
                understood = true;
                break;
            case 18:
                // select restaurant to proceed with a reservation.
                let restaurantNames = session.restaurantChoices.map(r => r.name)
                let restaurantChosenByUser = restaurantNames.filter(restaurant => lowerCaseMessage.includes(restaurant.toLowerCase()))
                if (restaurantChosenByUser.length === 1) {
                    session.chosenRestaurant = restaurantChosenByUser
                    session.stage = 19;
                    session.failCount = 0;
                    response = `Excellent! You have chosen ${session.chosenRestaurant}. Would you like to proceed with a reservation?`;
                    understood = true;
                } else if (restaurantChosenByUser.length > 1 || !restaurantChosenByUser) {
                    // redo this stage if user selects more than one restaurant or doesn't input a name of a restaurant
                    session.stage = 18;
                    session.failCount = 0;
                    response = "Please choose one (1) restaurant to proceed with a reservation";
                    understood = true
                }
                break;
            case 19:
                // handle reservation
                if (intent === "yes") {
                    session.stage = 21;
                    session.failCount = 0;
                    response = "How many people is the reservation for?"
                    understood = true;
                } else if (intent === "no") {
                    session.stage = 20;
                    session.failCount = 0;
                    response = "No problem. Would you like to search for an alternative restaurant?";  // if not, reset
                    understood = true;
                }
                break;
            case 20:
                // go back to the beginning to search for alternative restaurants
                if (intent === "yes") {
                    // remember current choices to add to list
                    prevRestaurantChoices = session.restaurantChoices // store existing restaurant in variable
                    session.restaurantData = {}
                    session.stage = 0;
                    session.failCount = 0;
                    understood = true;
                } else {
                    session.stage = 0;
                    session.failCount = 0;
                    response = "Bye! If you have any other questions, just ask. Which cuisine would you like to have? (Italian, Chinese, Mexican, Japanese, Indian, or American)";
                    understood = true;
                }
                break;
            case 21:
                // handle number of people
                const people = parseInt(lowerCaseMessage);
                if (!isNaN(people) && people > 0) {
                    session.reservation = {people};
                    session.stage = 22;
                    session.failCount = 0;
                    response = "Great! What time today would you like to make the reservation for? (Please use 24-hour format, e.g., 18:30)";
                    understood = true;
                } else {
                    response = "Please specify a valid number of people for the reservation.";
                }
                break;
            case 22:
                const timeMatch = lowerCaseMessage.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
                if (timeMatch) {
                    const reservationTime = `${timeMatch[1]}:${timeMatch[2]}`;
                    const restaurant = session.restaurantChoices[0]; //chooses first one to make a reservation for

                    if (isTimeWithinOpeningHours(reservationTime, restaurant.opening_hours)) {
                        session.reservation.time = reservationTime;
                        session.stage = 23;
                        session.failCount = 0;
                        response = "Got it! Do you have any allergies or dietary restrictions we should be aware of? (yes/no)";
                        understood = true;
                    }
                } else {
                    session.stage = 22;
                    session.failCount = 0;
                    response = `Sorry, please enter a valid time within the opening hours (${restaurant.opening_hours}). Or you can use 'go back' to check the opening hours again.`;
                    understood = true
                }
                break;
            case 23:
                if (intent === "yes") {
                    session.stage = 24;
                    session.failCount = 0;
                    response = "Please enter any allergies or dietary restrictions you would like the restaurant to be aware of"
                    understood = true;
                } else if (intent === "no") {
                    session.reservation.allergies = "none";
                    session.stage = 25;
                    session.failCount = 0;
                    response = "Thank you! Can I have your name for the reservation?";
                    understood = true;
                }
                break;
            case 24:
                session.reservation.allergies = lowerCaseMessage;
                session.stage = 25;
                session.failCount = 0;
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
                session.failCount = 0;
                understood = true;
                break;
            case 26:
                if (intent === "yes") {
                    session.stage = 20;
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
                    response = "I'm sorry, I didn't understand that. Could you please rephrase?";
                    if (session.history.length > 0) {
                        let lastEntry = session.history[session.history.length - 1];
                        const previousMessage = lastEntry.response
                        response += `\n ${previousMessage}`;
                    }
                } else if (session.failCount === 2) {
                    if (session.history.length > 0) {
                        let lastEntry = session.history[session.history.length - 1];
                        const previousMessage = lastEntry.response
                        response = previousMessage;
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
    const matchedRestaurants = [];

    // Iterate over each restaurant
    for (let i = 0; i < restaurants.length; i++) {
        const currentRestaurant = restaurants[i];
        let matchesAllCriteria = true;

        // Check if currentRestaurant meets all requirements
        for (const key in requirementDict) {
            if (requirementDict.hasOwnProperty(key)) {

                // Special checking for some criteria
                switch (key) {
                    case "rating":
                        // Ensure currentRestaurant[key] is a number
                        if (typeof currentRestaurant[key] !== 'number') {
                            matchesAllCriteria = false;
                            break;
                        }
                        if (currentRestaurant[key] < requirementDict[key]) {
                            matchesAllCriteria = false;
                        }
                        break;

                    case "ambiance":
                    case "menu_highlights":
                    case "payment_accepted":
                        if (!requirementDict[key].some(r => currentRestaurant[key].includes(r))) {
                            matchesAllCriteria = false;
                        }
                        break;

                    default:
                        // Check for potential issues with the default case
                        const requiredValue = String(requirementDict[key]).trim();
                        const currentValue = (typeof currentRestaurant[key] === 'string') ? currentRestaurant[key].trim() : String(currentRestaurant[key]).trim();

                        if (currentValue !== requiredValue) {
                            matchesAllCriteria = false;
                        }
                }

                // If a mismatch is found, break out of the current criteria check
                if (!matchesAllCriteria) {
                    break;
                }
            }
        }

        // If the restaurant matches all criteria, add it to matchedRestaurants
        if (matchesAllCriteria) {
            matchedRestaurants.push(currentRestaurant);
        }
    }

    return matchedRestaurants;
}


module.exports = determineRestaurant;
