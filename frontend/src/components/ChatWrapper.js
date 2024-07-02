import React from 'react';
import { useChat } from '../hooks/useChat';
import MessageList from './MessageList';
import UserInput from './UserInput';
import './chat.css';
import './message.css'
import './MessageArea.css';

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
        <div className={'chat-wrapper'}>
            <div className={'bg'}>
            <div className={'header'}>
                <h1>Restaurant Suggestion Chatbot</h1>
            </div>

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
        </div>
)
    ;
};

export default ChatWrapper;
