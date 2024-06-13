import io from 'socket.io-client';

const socket = io('https://restaurantchatbot.azurewebsites.net'); 

export const setupSocket = (setChatHistory, setIsTyping) => {
    socket.on('message', data => {
        setChatHistory(prev => [...prev, { userId: data.userId, name: data.name, type: data.type, text: data.text, timestamp: new Date() }]);
    });

    socket.on('typing', () => {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 1000);
    });

    return () => {
        socket.off('message');
        socket.off('typing');
    };
};

export const sendMessageToSocket = (message) => {
    socket.emit('userMessage', { message });
};

export default socket;
