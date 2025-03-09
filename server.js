const { randomInt } = require('crypto');
var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');
var app = express();
var server = http.Server(app);
var io = socketIO(server);

app.set('port', 5000);

// Serve the home screen (multiplayer home page)
app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'home.html')); // Serving home screen (home.html)
});

// Serve the math game (game page)
app.get('/game', function(req, res) {
  res.sendFile(path.join(__dirname, 'index.html')); // Serve the game page (index.html)
});

// Serve static files (game assets)
app.use('/static', express.static(path.join(__dirname, 'static')));

// Store player data and game state
var players = {};
var currentQuestion = generateMathQuestion();
var timeLeft = 60;  // Global timer for the game
var timerInterval;
var entered = 0;
// Define a function to generate random math questions
function generateMathQuestion() {
  var num1 = Math.floor(Math.random() * 20) + 1;
  var num2 = Math.floor(Math.random() * 20) + 1;
  var operation = Math.random()*4;
  let answer = 0;

  if (operation < 1) {
    answer = num1 + num2;
    operation = "+";
  } 
  else if (operation < 2) {
    answer = num1 - num2;
    operation = "-";
  } 
  else if (operation < 3) {
    answer = num1 * num2;
    operation = "x";
  } 
  else {
    num1 = num1*num2;
    answer = num1/num2;
    operation = "/";
  }

  return {
    question: `${num1} ${operation} ${num2}`,
    correctAnswer: answer
  };
}

//startTimer();
// Handle new player connection


io.on('connection', function(socket) {
  socket.on('starttime', function(answer) {
    if (entered == 0){
      startTimer();
    }
    entered++;
  });
  players[socket.id] = { score: 0, name: `Player ${Object.keys(players).length + 1}` };

  // Send the current question and time to the new player
  socket.emit('newQuestion', currentQuestion);
  socket.emit('scoreUpdate', players); // Send the current leaderboard
  socket.emit('timeUpdate', timeLeft); // Send the current time

  // Handle player's answer submission
  socket.on('submitAnswer', function(answer) {
    const player = players[socket.id];

    if (parseInt(answer) === currentQuestion.correctAnswer) {
      player.score += 10;
    }

    // Generate a new question for the game
    currentQuestion = generateMathQuestion();
    io.emit('newQuestion', currentQuestion);  // Send to all players
    io.emit('scoreUpdate', players);         // Update all players' scores
  });

  // Handle player disconnect
  socket.on('disconnect', function() {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
    io.emit('scoreUpdate', players);  // Update leaderboard when player disconnects
  });

  // Handle reset game when 'Play Again' is clicked
  socket.on('resetGame', function() {
    // Reset player scores
    players = {};
    currentQuestion = generateMathQuestion();
    timeLeft = 60;  // Reset time
    clearInterval(timerInterval);
    //startTimer();  // Restart timer
    io.emit('scoreUpdate', players);  // Notify all players to reset scores
    io.emit('timeUpdate', timeLeft);  // Reset the time
    io.emit('newQuestion', currentQuestion);  // Send new question to players
    entered = 0;
  });
});

// Timer countdown logic
function startTimer() {
  // Emit the time to all clients every second
  timerInterval = setInterval(() => {
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      io.emit('timeUpdate', 0);  // Notify all clients that time's up
      io.emit('gameOver');       // Game over notification to all players
    } else {
      timeLeft--;
      io.emit('timeUpdate', timeLeft);  // Broadcast the remaining time to all clients
    }
  }, 1000);
}

// Start the game and the timer when the first player connects
io.on('connection', function(socket) {
  if (Object.keys(players).length === 1 && timeLeft === 60) {  // Only start the timer once
    //startTimer();  // Start the timer when the first player connects
  }
});

// Start the server
server.listen(5000, function() {
  console.log('Server running on port 5000');
});
