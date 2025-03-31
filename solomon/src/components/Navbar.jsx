import React from "react";
import { Link } from "react-router-dom";
import "../assets/Navbar.css";

const Navbar = ({ onRestart }) => {
  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <img
          src="/icon.svg" // Replace with the actual path to your icon
          alt="Game Icon"
          className="navbar-icon"
        />
        <span className="navbar-title">SolomonTHEWise</span>
      </div>
      <div className="navbar-links">
        <Link to="/" className="navbar-link">
          Home
        </Link>
        <button className="navbar-button" onClick={onRestart}>
          Restart
        </button>
      </div>
    </nav>
  );
};

export default Navbar;

