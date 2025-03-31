import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load word bank
const wordBank = JSON.parse(fs.readFileSync(join(__dirname, 'wordBank.json'), 'utf8'));

const app = express();
app.use(cors());
app.use(express.json());

// Verify API key is available
if (!process.env.GEMINI_API_KEY) {
  console.error('API_KEY is not set in environment variables');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Simple rate limiting
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS_PER_WINDOW = 50;

function isRateLimited(ip) {
  const now = Date.now();
  const userRequests = requestCounts.get(ip) || [];
  const recentRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  
  recentRequests.push(now);
  requestCounts.set(ip, recentRequests);
  return false;
}

// Retry mechanism for Gemini API calls
async function retryGenerateContent(prompt, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().toLowerCase().trim();
      if (text && /^[a-z\s]+$/.test(text)) {
        return text;
      }
      throw new Error('Invalid response from AI');
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${i + 1} failed:`, error.message);
      
      if (error.message.includes('429') || error.message.includes('quota')) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}

// Game state and categories
let gameState = {
  word: '',
  questionsAsked: 0,
  isGameOver: false,
  mode: '',
  category: '',
  currentHintLevel: 0
};

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

const recentWordsByCategory = {};
categories.forEach(cat => recentWordsByCategory[cat] = []);

// Helper function for hints
function getRevealedIndices(length, level) {
  const indices = new Set();
  if (level >= 1) indices.add(0);
  if (level >= 2) indices.add(length - 1);
  if (level >= 3 && length >= 3) indices.add(Math.floor(length / 2));
  return indices;
}

// API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/hint/:level', (req, res) => {
  try {
    const level = parseInt(req.params.level, 10);

    if (!gameState.word) {
      return res.status(400).json({ error: 'No active game found' });
    }

    if (isNaN(level) || level < 1 || level > 4) {
      return res.status(400).json({ error: 'Invalid hint level' });
    }

    const word = gameState.word.toLowerCase();
    let hint = '';

    if (level === 4) {
      hint = word;
      gameState.isGameOver = true;
    } else {
      const words = word.split(' ');
      hint = words.map(w => {
        if (w.length === 0) return '';
        const indices = getRevealedIndices(w.length, level);
        return w.split('').map((char, i) => indices.has(i) ? char : '*').join('');
      }).join(' ');
    }

    gameState.currentHintLevel = level;

    return res.json({ hint, gameOver: level === 4 });
  } catch (error) {
    console.error('Hint error:', error);
    return res.status(500).json({ error: 'Server error while processing hint' });
  }
});

app.post('/api/start-game', async (req, res) => {
  try {
    const clientIP = req.ip;
    if (isRateLimited(clientIP)) {
      return res.status(429).json({
        error: 'Too many requests. Please wait a minute before trying again.'
      });
    }

    const { mode, category, word } = req.body;
    
    gameState = {
      word: '',
      questionsAsked: 0,
      isGameOver: false,
      mode,
      category: '',
      currentHintLevel: 0
    };

    if (mode === 'single') {
      // Use provided category or pick random if undefined
      const selectedCategory = category || categories[Math.floor(Math.random() * categories.length)];
      
      const wordsInCategory = wordBank[selectedCategory];
      if (!wordsInCategory || wordsInCategory.length === 0) {
        throw new Error('No words found for the selected category');
      }

      const recentWords = recentWordsByCategory[selectedCategory];
      const availableWords = wordsInCategory.filter(word => !recentWords.includes(word));
      
      if (availableWords.length === 0) {
        recentWords.length = 0;
        availableWords.push(...wordsInCategory);
      }

      const randomIndex = Math.floor(Math.random() * availableWords.length);
      const chosenWord = availableWords[randomIndex];
      
      gameState.word = chosenWord;
      gameState.category = selectedCategory;

      recentWords.push(chosenWord);
      if (recentWords.length > 5) {
        recentWords.shift();
      }

      res.json({ 
        success: true, 
        message: 'Game started',
        category: selectedCategory,
        word: chosenWord // Added to help with masking on client side
      });
    } else {
      const categoriesString = categories.join(', ');
      const prompt = `Which single category from this list does "${word}" best fit into: ${categoriesString}? Respond with just the category name, nothing else.`;
      
      try {
        const determinedCategory = await retryGenerateContent(prompt);
        if (!categories.includes(determinedCategory)) {
          throw new Error('Invalid category determined');
        }
        
        gameState.word = word.toLowerCase();
        gameState.category = determinedCategory;
        
        res.json({ 
          success: true, 
          message: 'Game started',
          category: determinedCategory
        });
      } catch (error) {
        console.error('Error determining category:', error);
        throw new Error('Failed to determine category');
      }
    }
  } catch (error) {
    console.error('Error starting game:', error);
    const errorMessage = error.message.includes('429') || error.message.includes('quota')
      ? 'Service is busy. Please try again shortly.'
      : error.message === 'Failed to generate a valid word'
        ? 'Could not generate a valid word. Please try again.'
        : 'Failed to start game. Please try again.';
    
    res.status(500).json({ error: errorMessage });
  }
});

app.post('/api/ask-question', async (req, res) => {
  try {
    const clientIP = req.ip;
    if (isRateLimited(clientIP)) {
      return res.status(429).json({
        error: 'Too many requests. Please wait a minute before trying again.'
      });
    }

    const { question } = req.body;
    
    if (gameState.questionsAsked >= 50) {
      return res.json({ error: 'Maximum questions reached' });
    }

    const prompt = `Regarding "${gameState.word}", answer the Question: "${question}". Answer only with yes or no, nothing else.`;
    const answer = await retryGenerateContent(prompt);
    gameState.questionsAsked++;
    
    res.json({
      answer,
      questionsRemaining: 50 - gameState.questionsAsked
    });
  } catch (error) {
    console.error('Error processing question:', error);
    const errorMessage = error.message.includes('429') || error.message.includes('quota')
      ? 'Service is busy. Please try again shortly.'
      : 'Failed to process question. Please try again.';
    
    res.status(500).json({ error: errorMessage });
  }
});

app.post('/api/make-guess', (req, res) => {
  try {
    const { guess } = req.body;
    const isCorrect = guess.toLowerCase() === gameState.word.toLowerCase();
    
    // Calculate base score based on questions asked
    let score = isCorrect ? 50 - gameState.questionsAsked : 0;
    
    // Calculate hint penalties using arithmetic progression
    // First hint is free, second hint -5, third hint -10, fourth hint -15
    if (gameState.currentHintLevel > 1) {
      const hintPenalty = Array.from(
        { length: gameState.currentHintLevel - 1 },
        (_, index) => (index + 1) * 5
      ).reduce((sum, penalty) => sum + penalty, 0);
      score -= hintPenalty;
    }

    // Ensure score doesn't go below 0
    score = Math.max(0, score);
    
    gameState.isGameOver = true;
    
    res.json({
      correct: isCorrect,
      score,
      word: gameState.word,
      hintsUsed: gameState.currentHintLevel
    });
  } catch (error) {
    console.error('Error processing guess:', error);
    res.status(500).json({ error: 'Failed to process guess' });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});