import React from 'react';
import { useChat } from '../hooks/useChat';
import MessageList from './MessageList';
import UserInput from './UserInput';
import '../styles/message.css';
import '../styles/chat.css';

const ChatWrapper = () => {
    const {
        message,
        setMessage,
        chatHistory,
        isTyping,
        chatContainerRef,
        sendMessage,
    } = useChat();

    return (
        <div className="chat-wrapper">
            <MessageList 
                chatHistory={chatHistory} 
                isTyping={isTyping} 
                chatContainerRef={chatContainerRef} 
            />
            <UserInput 
                message={message} 
                setMessage={setMessage} 
                sendMessage={sendMessage} 
            />
        </div>
    );
};

export default ChatWrapper;
