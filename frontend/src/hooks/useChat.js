import { useState, useEffect, useRef } from 'react';
import debounce from 'lodash/debounce';
import { setupSocket, sendMessageToSocket } from '../services/socket';

export const useChat = () => {
    const [message, setMessage] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const chatContainerRef = useRef(null);
    const isUserScrolling = useRef(false);

    useEffect(() => {
        const cleanup = setupSocket(setChatHistory, setIsTyping);
        return cleanup;
    }, []);

    useEffect(() => {
        if (chatContainerRef.current && !isUserScrolling.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    const handleScroll = debounce(() => {
        const { scrollTop } = chatContainerRef.current;
        isUserScrolling.current = scrollTop > 0;
    }, 100);

    useEffect(() => {
        const container = chatContainerRef.current;
        container.addEventListener('scroll', handleScroll);

        return () => {
            container.removeEventListener('scroll', handleScroll);
        };
    }, [handleScroll]);

    const sendMessage = (e) => {
        e.preventDefault();
        if (message.trim()) {
            setChatHistory(prev => [...prev, { userId: socket.id, name: 'User', type: 'user', text: message, timestamp: new Date() }]);
            sendMessageToSocket(message);
            setMessage('');
            isUserScrolling.current = false; // Reset the scroll flag on new message
        }
    };

    return {
        message,
        setMessage,
        chatHistory,
        isTyping,
        chatContainerRef,
        sendMessage,
    };
};
