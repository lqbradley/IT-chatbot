import React from 'react';
import Chat from './Chat';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1 className = "App-title">Resturant Suggestion Chatbot</h1>
      </header>
      <Chat />
    </div>
  );
}

export default App;

