import express from "express";
import { 
  getForums,
  getForumById,
  createForum,
  updateForum,
  deleteForum,
  getForumPosts,
  createForumPost,
  getForumPostById,
  addCommentToPost
} from "../controllers/forum.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

// Forums routes
router.get("/", getForums);
router.get("/:id", getForumById);
router.post("/", verifyToken, createForum);
router.put("/:id", verifyToken, updateForum);
router.delete("/:id", verifyToken, deleteForum);

// Forum posts routes
router.get("/:forumId/posts", getForumPosts);
router.get("/:forumId/posts/:postId", getForumPostById);
router.post("/:forumId/posts", verifyToken, createForumPost);

// Forum post comments routes
router.post("/:forumId/posts/:postId/comments", verifyToken, addCommentToPost);

export default router; 