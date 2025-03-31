import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import "./App.css";
import Navbar from "./components/Navbar";
import Home from "./pages/home";
import SinglePlayerGame from "./pages/single";

// Create a wrapper component for SinglePlayerGame
const SinglePlayerWrapper = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const refreshGame = () => {
    // Force a re-render by navigating to the same route
    navigate(0);
  };

  return <SinglePlayerGame onRefresh={refreshGame} />;
};

function App() {
  const handleRestart = () => {
    // Get current location
    const path = window.location.pathname;
    if (path === '/single') {
      // Force page refresh only on single player page
      window.location.reload();
    }
  };

  return (
    <Router>
      <Navbar onRestart={handleRestart} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/single" element={<SinglePlayerWrapper />} />
      </Routes>
    </Router>
  );
}

export default App;
