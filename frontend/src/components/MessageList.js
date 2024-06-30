import React from 'react';
import './message.css';
import './MessageArea.css';

const MessageList = ({ chatHistory, isTyping, chatContainerRef }) => {
    return (
        <div className="chat-container" ref={chatContainerRef}>
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
    );
};

export default MessageList;
