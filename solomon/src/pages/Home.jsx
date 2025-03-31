import React from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate for navigation

const Home = () => {
  const navigate = useNavigate(); // Initialize the navigate function

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Welcome to Solomon THE Wise</h1>
      <p>Embark on an exciting journey of wisdom and strategy!</p>
      <div>
        <img
          src="/icon.svg" // Replace with the correct path to your icon.svg file
          alt="Game Icon"
          style={{ width: "200px", height: "200px", marginTop: "20px" }}
        />
      </div>
      {/* Buttons */}
      <div style={{ margin: "20px 0" }}>
        <button
          style={buttonStyle}
          onClick={() => navigate("/single")} // Redirect to single.jsx
        >
          Single Player
        </button>
        <button style={buttonStyle}>Multiplayer</button>
      </div>
    </div>
  );
};

// Button styles
const buttonStyle = {
  padding: "10px 20px",
  margin: "10px",
  fontSize: "16px",
  backgroundColor: "#2ecc71",
  color: "white",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
};

export default Home;


