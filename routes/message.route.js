import express from "express";
import {
  addMessage,
  getMessages,
  getGeneralChatMessages,
  addGeneralChatMessage
} from "../controllers/message.controller.js";
import {verifyToken} from "../middleware/verifyToken.js";

const router = express.Router();

// General chat routes (these specific routes must come before parameterized routes)
router.get("/general", verifyToken, getGeneralChatMessages);
router.post("/general", verifyToken, addGeneralChatMessage);

// Chat messages routes with parameter
router.get("/:chatId", verifyToken, getMessages);
router.post("/:chatId", verifyToken, addMessage);

export default router;
