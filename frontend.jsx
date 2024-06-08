import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
let socket;

const Chat = () => {
    const [message, setMessage] = useState('');
    const [chat, setChat] = useState([]);

    useEffect(() => {
        socket = io('http://localhost:4000');
        socket.on('response', (data) => {
            setChat([...chat, data.message]);
        });
        return () => {
            socket.off();
        };
    }, [chat]);

    const sendMessage = (e) => {
        e.preventDefault();
        socket.emit('message', { message });
        setMessage('');
    };

    return (
        <div>
            <form onSubmit={sendMessage}>
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ask me for travel recommendations..."
                    required
                />
                <button type="submit">Send</button>
            </form>
            {chat.map((msg, index) => (
                <div key={index}>{msg}</div>
            ))}
        </div>
    );
};

export default Chat;
