import React from 'react';
import { FaPaperPlane } from 'react-icons/fa';

const UserInput = ({ message, setMessage, sendMessage }) => {
    return (
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
    );
};

export default UserInput;
