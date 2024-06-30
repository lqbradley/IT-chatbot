import React, {useState} from 'react';
import { FaPaperPlane } from 'react-icons/fa';
import './message.css'
import './UserInput.css'

const UserInput = ({ message, setMessage, sendMessage }) => {
        return (
        <form onSubmit={sendMessage} className="input-group">
            <input
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Enter your message here"
                required
            />
            <button type="submit"><FaPaperPlane /></button>
        </form>
    );
};

export default UserInput;
