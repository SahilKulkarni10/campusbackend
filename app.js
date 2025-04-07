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
    ],
    credentials: true,
  },
});

// Make socket.io instance available to routes
app.set('io', io);

// CORS Middleware
const allowedOrigins = [process.env.CLIENT_URL_LOCAL, process.env.CLIENT_URL_PROD];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

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
    removeUser(socket.id);
    io.emit("getOnlineUsers", onlineUsers);
  });
});

// Start Server
const PORT = process.env.PORT || 8800;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}!`);
});
