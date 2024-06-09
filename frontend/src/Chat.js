import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './message.css';
import './chat.css';
import { debounce } from 'lodash';
import { FaPaperPlane } from 'react-icons/fa';

const socket = io('http://localhost:4000');

function Chat() {
    const [message, setMessage] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
/*    const [loadingHistory, setLoadingHistory] = useState(false);*/
    const chatContainerRef = useRef(null);
    const isUserScrolling = useRef(false);
/*   const oldestMessageTimestamp = useRef(null); */

    useEffect(() => {
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
    }, []);

    useEffect(() => {
        if (chatContainerRef.current && !isUserScrolling.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    /*const fetchHistory = async () => {
        // Placeholder for fetching history from a server or local storage
        // Replace this with the actual implementation
        // Assuming the function fetches messages older than the oldestMessageTimestamp
        return [
            { userId: '1', name: 'Bot', type: 'bot', text: 'Previous bot message', timestamp: new Date(Date.now() - 60000) },
            { userId: '2', name: 'User', type: 'user', text: 'Previous user message', timestamp: new Date(Date.now() - 60000) }
        ];
    };

    const loadMoreHistory = async () => {
        setLoadingHistory(true);
        const history = await fetchHistory();
        if (history.length > 0) {
            setChatHistory(prev => [...history, ...prev]);
            oldestMessageTimestamp.current = history[0].timestamp;
        }
        setLoadingHistory(false);
    };*/

    const handleScroll = debounce(() => {
        const { scrollTop } = chatContainerRef.current;
        isUserScrolling.current = scrollTop > 0;

    /*    if (scrollTop === 0 && !loadingHistory) {
            loadMoreHistory();
        }*/
    }, 100);

    useEffect(() => {
        const container = chatContainerRef.current;
        container.addEventListener('scroll', handleScroll);

        return () => {
            container.removeEventListener('scroll', handleScroll);
        };
    }, [handleScroll]);

    const sendMessage = e => {
        e.preventDefault();
        if (message.trim()) {
            setChatHistory(prev => [...prev, { userId: socket.id, name: 'User', type: 'user', text: message, timestamp: new Date() }]);
            socket.emit('userMessage', { message });
            setMessage('');
            isUserScrolling.current = false; // Reset the scroll flag on new message
        }
    };

    return (
        <div className="chat-wrapper">
            <div className="chat-container" ref={chatContainerRef} onScroll={handleScroll}>
                {chatHistory.map((msg, index) => (
                    <div key={index} className={`message ${msg.type}`}>
                        <div className="message-header">
                            {msg.type === 'bot' ? (
                                <>
                                    <strong>{msg.name}</strong>
                                    <small>{msg.timestamp.toLocaleTimeString()}</small>
                                </>
                            ) : (
                                <>
                                    <small>{msg.timestamp.toLocaleTimeString()}</small>
                                    <strong>{msg.name}</strong>
                                </>
                            )}
                        </div>
                        <div className={`${msg.type}-text`}>
                            <span>{msg.text}</span>
                        </div>
                    </div>
                ))}
                {isTyping && <div className="message bot"><div className="bot-text"><strong>System</strong> Typing...</div></div>}
            </div>
            <form onSubmit={sendMessage} className="input-group">
                <input
                    type="text"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Enter keywords..."
                    required
                />
                <button type="submit"><FaPaperPlane /></button>
            </form>
        </div>
    );
}

export default Chat;
