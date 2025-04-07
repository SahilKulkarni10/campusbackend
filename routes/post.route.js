import express from "express";
import { 
  getPosts, 
  getPostById, 
  createPost, 
  updatePost, 
  deletePost,
  getPostsByCategory 
} from "../controllers/post.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

// Get all posts or filter by category
router.get("/", getPosts);

// Get posts by category
router.get("/category/:category", getPostsByCategory);

// Get single post by ID
router.get("/:id", getPostById);

// Create a new post (protected)
router.post("/", verifyToken, createPost);

// Update a post (protected)
router.put("/:id", verifyToken, updatePost);

// Delete a post (protected)
router.delete("/:id", verifyToken, deletePost);

export default router;
