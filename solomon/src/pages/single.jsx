import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../assets/SinglePlayer.css';

const categories = [
  'famous person',
  'company',
  'animal',
  'object',
  'place',
  'food',
  'movie',
  'book',
  'sport',
  'musical instrument',
  'historical event',
  'scientific discovery',
  'technology brand',
  'video game',
  'TV show'
];

const SinglePlayerGame = () => {
  const [gameState, setGameState] = useState({
    word: '',
    category: '',
    questionsAsked: 0,
    isGameOver: false,
    hints: [],
    currentHintLevel: 0,
    points: 50
  });

  const [userInput, setUserInput] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showCategorySelect, setShowCategorySelect] = useState(true);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const calculateHintPenalty = () => {
    if (gameState.currentHintLevel <= 1) return 0;
    
    // Calculate sum of arithmetic progression for penalties
    // Example: 2nd hint = 5, 3rd hint = 10, 4th hint = 15
    return Array.from(
      { length: gameState.currentHintLevel - 1 },
      (_, index) => (index + 1) * 5
    ).reduce((sum, penalty) => sum + penalty, 0);
  };

  const handleInputSubmit = async (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    try {
      setIsLoading(true);
      const input = userInput.trim().toLowerCase();

      // First try to make a guess
      const guessResponse = await axios.post('http://localhost:3000/api/make-guess', {
        guess: input
      });

      if (guessResponse.data.correct) {
        setGameState(prev => ({
          ...prev,
          isGameOver: true,
          word: guessResponse.data.word
        }));

        setConversation(prev => [...prev, {
          type: 'victory',
          text: <>
            🎉 Congratulations! You won!
            <span className="victory-word">{guessResponse.data.word}</span>
            <span className="victory-score">Final Score: {guessResponse.data.score}</span>
          </>
        }]);
      } else {
        // If guess is wrong, treat as question
        setConversation(prev => [...prev, { type: 'question', text: input }]);
        
        const questionResponse = await axios.post('http://localhost:3000/api/ask-question', {
          question: input
        });

        setGameState(prev => ({
          ...prev,
          questionsAsked: prev.questionsAsked + 1
        }));

        setConversation(prev => [...prev, {
          type: 'answer',
          text: `${questionResponse.data.answer} (${questionResponse.data.questionsRemaining} questions remaining)`
        }]);
      }

      setUserInput('');
    } catch (error) {
      setConversation(prev => [...prev, {
        type: 'error',
        text: error.response?.data?.error || 'Failed to process input'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startGameWithCategory = async (category) => {
    try {
      setIsLoading(true);
      const response = await axios.post('http://localhost:3000/api/start-game', {
        mode: 'single',
        // Only send undefined for explicit random choice (empty string)
        category: category === '' ? undefined : category
      });
      
      // Get first hint automatically
      const firstHintResponse = await axios.get('http://localhost:3000/api/hint/1');
      
      setGameState(prev => ({
        ...prev,
        category: response.data.category,
        word: response.data.word,
        isGameOver: false,
        questionsAsked: 0,
        hints: [firstHintResponse.data.hint],
        currentHintLevel: 1,
        points: 50
      }));
      
      setConversation([
        {
          type: 'system',
          text: `New game started! Category: ${response.data.category}`
        },
        {
          type: 'system',
          text: `Hint 1: ${firstHintResponse.data.hint}`
        }
      ]);
      setMessage('');
      setUserInput('');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to start game');
    } finally {
      setIsLoading(false);
    }
  };

  const startGame = async () => {
    setShowCategorySelect(false);
    await startGameWithCategory(selectedCategory);
  };

  const resetGame = async () => {
    const currentCategory = gameState.category;
    await startGameWithCategory(currentCategory);
  };

  const getHint = async () => {
    try {
      setIsLoading(true);
      const nextHintLevel = gameState.currentHintLevel + 1;
      const response = await axios.get(`http://localhost:3000/api/hint/${nextHintLevel}`);

      const pointDeduction = nextHintLevel > 1 ? nextHintLevel * 5 - 5 : 0;
      const currentPoints = Math.max(0, gameState.points - gameState.questionsAsked - calculateHintPenalty() - pointDeduction);

      setGameState(prev => ({
        ...prev,
        hints: [...prev.hints, response.data.hint],
        currentHintLevel: nextHintLevel,
        isGameOver: response.data.gameOver
        
      }));

      const hintMessage = nextHintLevel > 1 
        ? `Hint ${nextHintLevel}: ${response.data.hint} (-${pointDeduction} points) [Current points: ${currentPoints}]`
        : `Hint ${nextHintLevel}: ${response.data.hint}`;

      setConversation(prev => [...prev, {
        type: 'system',
        text: hintMessage
      }]);
    } catch (error) {
      setConversation(prev => [...prev, {
        type: 'error',
        text: error.response?.data?.error || 'Failed to get hint'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    
    <div className="single-player-game">
      <div className="game-header">
        {!showCategorySelect && (
          <>
            <h2 className="masked-word">
              {gameState.word && !gameState.hints.length 
                ? '* '.repeat(gameState.word.length).trim()
                : gameState.hints[gameState.hints.length - 1]}
            </h2>
            <div className="game-stats">
              <span>Questions: {gameState.questionsAsked}</span>
              <span>Points: {Math.max(0, gameState.points - gameState.questionsAsked - calculateHintPenalty())}</span>
              <span>Category : {gameState.category}</span>
              <span>Hints: {gameState.hints.length-1}</span>
            </div>
          </>
        )}
      </div>

      {showCategorySelect ? (
        <div className="category-selection">
          <h3>Choose a Category</h3>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            disabled={isLoading}
          >
            <option value="">Random Category</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <button 
            onClick={startGame} 
            disabled={isLoading}
            className="start-game"
          >
            Start Game
          </button>
        </div>
      ) : (
        <>
          <div className="chat-container">
            {conversation.map((item, index) => (
              <div key={index} className={`chat-message ${item.type}`}>
                {item.type === 'question' && <span className="question-prefix">Q:</span>}
                {item.type === 'answer' && <span className="answer-prefix">A:</span>}
                {typeof item.text === 'string' ? item.text : item.text}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {!gameState.isGameOver && (
            <form onSubmit={handleInputSubmit} className="game-controls">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Type your question or guess here..."
                disabled={isLoading}
                autoFocus
              />
              <div className="button-group">
                <button type="submit" disabled={isLoading}>
                  Send
                </button>
                <button 
                  type="button" 
                  onClick={getHint} 
                  disabled={isLoading || gameState.currentHintLevel >= 4}
                >
                  Get Hint
                </button>
              </div>
            </form>
          )}

          {gameState.isGameOver && (
            <button 
              onClick={resetGame} 
              disabled={isLoading}
              className="play-again"
            >
              Play Again in {gameState.category}
            </button>
          )}
        </>
      )}

      {message && <p className="message">{message}</p>}
    </div>
  );
};

export default SinglePlayerGame;