import React from 'react';
import ChatWrapper from './components/ChatWrapper.js';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
function App() {
  return (
      <div className="App"
           style={{background: 'var(--chat-bg)'}}>
          <ChatWrapper/>
      </div>
  );
}

export default App;

