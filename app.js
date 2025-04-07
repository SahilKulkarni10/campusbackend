import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import http from "http";
import authRoute from "./routes/auth.route.js";
import postRoute from "./routes/post.route.js";
import testRoute from "./routes/test.route.js";
import userRoute from "./routes/user.route.js";
import chatRoute from "./routes/chat.route.js";
import messageRoute from "./routes/message.route.js";
import forumRoutes from "./routes/forum.route.js";

const app = express();
const server = http.createServer(app); // Create an HTTP server
const io = new Server(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL_LOCAL,
      process.env.CLIENT_URL_PROD,
      // Add wildcard for development and troubleshooting
      '*',
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000, // Increase ping timeout to 60 seconds
  pingInterval: 25000, // Ping every 25 seconds
});

// Make socket.io instance available to routes
app.set('io', io);

// CORS Middleware
const allowedOrigins = [
  process.env.CLIENT_URL_LOCAL, 
  process.env.CLIENT_URL_PROD,
];

// Add additional origins from environment variables
if (process.env.ADDITIONAL_ORIGINS) {
  const additionalOrigins = process.env.ADDITIONAL_ORIGINS.split(',').map(origin => {
    // Convert domain patterns to full URLs or regex patterns
    if (origin.startsWith('http')) return origin;
    if (origin.includes('*')) return new RegExp(origin.replace('*', '.*'));
    return `https://${origin}`;
  });
  allowedOrigins.push(...additionalOrigins);
}

// Also allow all origins in development
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('*');
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl requests)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin is allowed
      const isAllowed = 
        allowedOrigins.includes(origin) || 
        allowedOrigins.includes('*') ||
        // Check against regex patterns
        allowedOrigins.some(allowedOrigin => 
          allowedOrigin instanceof RegExp && allowedOrigin.test(origin)
        );
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.log('CORS blocked for origin:', origin);
        console.log('Allowed origins:', allowedOrigins);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

app.use(express.json());
app.use(cookieParser());

// Debug route for socket testing
app.get('/socket-test', (req, res) => {
  res.send({ 
    status: 'server_ok',
    message: 'Socket.IO server is running',
    socketConnectionCount: io.engine.clientsCount,
    activeConnections: Object.keys(io.sockets.sockets).length,
    onlineUsers
  });
});

// Health check route for Render.com
app.get('/', (req, res) => {
  res.send('Campus Connect API is running');
});

// Routes
app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);
app.use("/api/posts", postRoute);
app.use("/api/test", testRoute);
app.use("/api/chats", chatRoute);
app.use("/api/messages", messageRoute);
app.use("/api/forums", forumRoutes);

// Socket.IO Logic
// Store connected users globally
let onlineUsers = [];
// Store socketId by userId for direct messaging globally
const onlineUserMap = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Respond to ping with pong for connection debugging
  socket.on('ping', () => {
    console.log('Received ping from client:', socket.id);
    socket.emit('pong');
  });

  // Add user to online users array
  const addUser = (userId) => {
    // Don't add duplicates
    if (!userId || onlineUsers.includes(userId)) return;
    onlineUsers.push(userId);
    console.log("Online users:", onlineUsers);
  };

  // Remove user from online users array
  const removeUser = (socketId) => {
    const user = onlineUserMap[socketId];
    if (user) {
      onlineUsers = onlineUsers.filter(id => id !== user);
      delete onlineUserMap[socketId];
      console.log("User disconnected:", user);
      console.log("Online users:", onlineUsers);
    }
  };

  // New user connects
  socket.on("newUser", (userId) => {
    console.log(`New user connected: ${userId} via socket ${socket.id}`);
    addUser(userId);
    onlineUserMap[socket.id] = userId;
    
    // Notify all connected clients of online users
    io.emit("getOnlineUsers", onlineUsers);
  });

  // Send message event
  socket.on("sendMessage", ({ receiverId, data }) => {
    console.log("Sending message to:", receiverId);
    // Send directly to receiver if online
    const receiverSocketIds = Object.entries(onlineUserMap)
      .filter(([_, id]) => id === receiverId)
      .map(([socketId]) => socketId);

    if (receiverSocketIds.length > 0) {
      // User is online, send message directly
      receiverSocketIds.forEach(socketId => {
        io.to(socketId).emit("getMessage", data);
      });
    }
  });
  
  // General chat message event
  socket.on("sendGeneralMessage", (data) => {
    console.log("Received general chat message:", data.text);
    // Broadcast to all users except sender
    socket.broadcast.emit("getGeneralMessage", data);
  });

  // Handle typing indicators
  socket.on("typing", ({ senderId, receiverId, isTyping }) => {
    console.log(`User ${senderId} ${isTyping ? 'is typing' : 'stopped typing'} to ${receiverId}`);
    
    // Send typing status to receiver
    const receiverSocketIds = Object.entries(onlineUserMap)
      .filter(([_, id]) => id === receiverId)
      .map(([socketId]) => socketId);

    if (receiverSocketIds.length > 0) {
      receiverSocketIds.forEach(socketId => {
        io.to(socketId).emit("userTyping", { senderId, isTyping });
      });
    }
  });
  
  // Handle general chat typing indicators
  socket.on("typingGeneral", ({ senderId, username, isTyping }) => {
    console.log(`User ${username} (${senderId}) ${isTyping ? 'is typing' : 'stopped typing'} in general chat`);
    
    // Broadcast typing status to all users except sender
    socket.broadcast.emit("userTypingGeneral", { senderId, username, isTyping });
  });
  
  // New forum post event
  socket.on("newForumPost", (data) => {
    console.log("New forum post:", data.title);
    socket.broadcast.emit("getForumPost", data);
  });
  
  // New comment event
  socket.on("newComment", (data) => {
    console.log("New comment on post:", data.postId);
    socket.broadcast.emit("getComment", data);
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
    removeUser(socket.id);
    io.emit("getOnlineUsers", onlineUsers);
  });
});

// Start Server
const PORT = process.env.PORT || 8800;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}!`);
  console.log(`Socket.IO server is ready for connections`);
  console.log(`CORS allowed origins: ${JSON.stringify(allowedOrigins)}`);
});
