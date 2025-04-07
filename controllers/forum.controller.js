import prisma from "../lib/prisma.js";
import createError from "../lib/createError.js";

// Forum Controllers
export const getForums = async (req, res, next) => {
  try {
    const forums = await prisma.forum.findMany({
      orderBy: {
        updatedAt: "desc"
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        },
        _count: {
          select: {
            posts: true
          }
        }
      }
    });

    // Format the response
    const formattedForums = forums.map(forum => ({
      id: forum.id,
      title: forum.title,
      description: forum.description,
      posts: forum._count.posts,
      createdBy: forum.creator ? {
        id: forum.creator.id,
        username: forum.creator.username,
        avatar: forum.creator.avatar
      } : null,
      createdAt: forum.createdAt,
      updatedAt: forum.updatedAt,
      lastActivity: forum.updatedAt
    }));

    res.status(200).json(formattedForums);
  } catch (error) {
    next(error);
  }
};

export const getForumById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const forum = await prisma.forum.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        },
        _count: {
          select: {
            posts: true
          }
        }
      }
    });

    if (!forum) {
      return next(createError(404, "Forum not found"));
    }

    // Format the response
    const formattedForum = {
      id: forum.id,
      title: forum.title,
      description: forum.description,
      posts: forum._count.posts,
      createdBy: forum.creator ? {
        id: forum.creator.id,
        username: forum.creator.username,
        avatar: forum.creator.avatar
      } : null,
      createdAt: forum.createdAt,
      updatedAt: forum.updatedAt,
      lastActivity: forum.updatedAt
    };

    res.status(200).json(formattedForum);
  } catch (error) {
    next(error);
  }
};

export const createForum = async (req, res, next) => {
  try {
    const { title, description } = req.body;

    if (!title) {
      return next(createError(400, "Title is required"));
    }

    const newForum = await prisma.forum.create({
      data: {
        title,
        description,
        createdBy: req.userId
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      }
    });

    res.status(201).json(newForum);
  } catch (error) {
    next(error);
  }
};

export const updateForum = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    const forum = await prisma.forum.findUnique({
      where: { id }
    });

    if (!forum) {
      return next(createError(404, "Forum not found"));
    }

    if (forum.createdBy !== req.userId) {
      return next(createError(403, "You can only update forums you created"));
    }

    const updatedForum = await prisma.forum.update({
      where: { id },
      data: {
        title,
        description,
        updatedAt: new Date()
      }
    });

    res.status(200).json(updatedForum);
  } catch (error) {
    next(error);
  }
};

export const deleteForum = async (req, res, next) => {
  try {
    const { id } = req.params;

    const forum = await prisma.forum.findUnique({
      where: { id }
    });

    if (!forum) {
      return next(createError(404, "Forum not found"));
    }

    if (forum.createdBy !== req.userId) {
      return next(createError(403, "You can only delete forums you created"));
    }

    // Delete all posts and comments related to this forum
    const forumPosts = await prisma.forumPost.findMany({
      where: { forumId: id }
    });

    // Delete comments for each post
    for (const post of forumPosts) {
      await prisma.comment.deleteMany({
        where: { postId: post.id }
      });
    }

    // Delete all posts
    await prisma.forumPost.deleteMany({
      where: { forumId: id }
    });

    // Delete the forum
    await prisma.forum.delete({
      where: { id }
    });

    res.status(200).json({ message: "Forum deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// Forum Posts Controllers
export const getForumPosts = async (req, res, next) => {
  try {
    const { forumId } = req.params;
    const { page = 1, limit = 5 } = req.query;
    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    
    // Validate pagination parameters
    if (isNaN(parsedPage) || parsedPage < 1) {
      return next(createError(400, "Invalid page parameter"));
    }
    
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 20) {
      return next(createError(400, "Invalid limit parameter (must be 1-20)"));
    }

    // Calculate how many records to skip
    const skip = (parsedPage - 1) * parsedLimit;

    // Check if forum exists
    const forum = await prisma.forum.findUnique({
      where: { id: forumId },
      select: { id: true } // Only select the ID to minimize data transfer
    });

    if (!forum) {
      return next(createError(404, "Forum not found"));
    }

    // Get count of total posts for the forum (optional, remove if performance is critical)
    const totalPostsCount = await prisma.forumPost.count({
      where: { forumId }
    });

    // Fetch paginated posts with optimized includes
    const posts = await prisma.forumPost.findMany({
      where: { forumId },
      orderBy: {
        createdAt: "desc"
      },
      skip,
      take: parsedLimit,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        },
        // Only include the most recent comments with limited fields
        comments: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 5 // Limit to most recent comments for performance
        },
        _count: {
          select: {
            comments: true
          }
        }
      }
    });

    // Transform the data for optimal client-side rendering
    const formattedPosts = posts.map(post => ({
      id: post.id,
      title: post.title,
      content: post.content,
      author: post.author.username,
      authorId: post.author.id,
      authorAvatar: post.author.avatar,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      commentsCount: post._count.comments,
      comments: post.comments.map(comment => ({
        id: comment.id,
        text: comment.text,
        author: comment.author.username,
        authorId: comment.author.id,
        authorAvatar: comment.author.avatar,
        createdAt: comment.createdAt
      }))
    }));

    // Add pagination metadata if total count is available
    if (totalPostsCount !== undefined) {
      res.set({
        'X-Total-Count': totalPostsCount,
        'X-Page-Count': Math.ceil(totalPostsCount / parsedLimit)
      });
    }

    res.status(200).json(formattedPosts);
  } catch (error) {
    next(error);
  }
};

export const getForumPostById = async (req, res, next) => {
  try {
    const { forumId, postId } = req.params;

    const post = await prisma.forumPost.findFirst({
      where: { 
        id: postId,
        forumId
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
          },
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });

    if (!post) {
      return next(createError(404, "Post not found"));
    }

    res.status(200).json(post);
  } catch (error) {
    next(error);
  }
};

export const createForumPost = async (req, res, next) => {
  try {
    const { forumId } = req.params;
    const { title, content } = req.body;

    if (!title || !content) {
      return next(createError(400, "Title and content are required"));
    }

    const forum = await prisma.forum.findUnique({
      where: { id: forumId }
    });

    if (!forum) {
      return next(createError(404, "Forum not found"));
    }

    const newPost = await prisma.forumPost.create({
      data: {
        title,
        content,
        authorId: req.userId,
        forumId
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      }
    });

    // Update the forum's last activity timestamp
    await prisma.forum.update({
      where: { id: forumId },
      data: {
        updatedAt: new Date()
      }
    });

    // Emit a socket event for the new post if socket.io is available
    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.emit("newForumPost", {
        postId: newPost.id,
        title: newPost.title,
        userId: newPost.authorId,
        timestamp: newPost.createdAt,
      });
    }

    res.status(201).json(newPost);
  } catch (error) {
    next(error);
  }
};

// Comments Controllers
export const addCommentToPost = async (req, res, next) => {
  try {
    const { forumId, postId } = req.params;
    const { text } = req.body;

    if (!text) {
      return next(createError(400, "Comment text is required"));
    }

    const post = await prisma.forumPost.findFirst({
      where: { 
        id: postId,
        forumId
      }
    });

    if (!post) {
      return next(createError(404, "Post not found"));
    }

    const newComment = await prisma.comment.create({
      data: {
        text,
        authorId: req.userId,
        postId
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      }
    });

    // Update the forum's last activity timestamp
    await prisma.forum.update({
      where: { id: forumId },
      data: {
        updatedAt: new Date()
      }
    });

    // Emit a socket event for the new comment if socket.io is available
    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.emit("newComment", {
        postId: post.id,
        commentId: newComment.id,
        text: newComment.text,
        userId: newComment.authorId,
        postUserId: post.authorId,
        postTitle: post.title,
        timestamp: newComment.createdAt,
      });
    }

    res.status(201).json(newComment);
  } catch (error) {
    next(error);
  }
};

// Add a post
export const addPost = async (req, res, next) => {
  try {
    // Validate input
    const { title, desc, categories } = req.body;
    if (!title || !desc) {
      return next(createError(400, "Title and description are required"));
    }

    const newPost = new Post({
      title,
      desc,
      categories: categories || [],
      userId: req.user.id,
    });

    await newPost.save();

    // Get the user details to include in the response
    const user = await User.findById(req.user.id);
    
    // Format the post to include user details
    const postWithUser = {
      ...newPost._doc,
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
      }
    };

    // Emit a socket event for the new post if socket.io is available
    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.emit("newForumPost", {
        postId: newPost._id,
        title: newPost.title,
        userId: newPost.userId,
        timestamp: newPost.createdAt,
      });
    }

    res.status(201).json(postWithUser);
  } catch (err) {
    next(err);
  }
};

// Get post by id
export const getPostById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);
    
    if (!post) {
      return next(createError(404, "Post not found"));
    }
    
    // Get user details
    const user = await User.findById(post.userId);
    
    // Get comment user details
    const commentsWithUser = await Promise.all(
      post.comments.map(async (comment) => {
        const commentUser = await User.findById(comment.userId);
        return {
          ...comment.toObject(),
          user: {
            id: commentUser?._id,
            username: commentUser?.username,
            avatar: commentUser?.avatar,
          },
        };
      })
    );
    
    const postWithDetails = {
      ...post.toObject(),
      comments: commentsWithUser,
      user: {
        id: user?._id,
        username: user?.username,
        avatar: user?.avatar,
      },
    };
    
    res.status(200).json(postWithDetails);
  } catch (err) {
    next(err);
  }
};

// Get all posts
export const getAllPosts = async (req, res, next) => {
  try {
    const { category } = req.query;
    
    // Filter by category if provided
    const filter = category ? { categories: { $in: [category] } } : {};
    
    const posts = await Post.find(filter).sort({ createdAt: -1 });
    
    // Get user details for each post
    const postsWithUser = await Promise.all(
      posts.map(async (post) => {
        const user = await User.findById(post.userId);
        return {
          ...post.toObject(),
          user: {
            id: user?._id,
            username: user?.username,
            avatar: user?.avatar,
          },
        };
      })
    );
    
    res.status(200).json(postsWithUser);
  } catch (err) {
    next(err);
  }
};

// Add a comment
export const addComment = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;
    
    if (!text) {
      return next(createError(400, "Comment text is required"));
    }

    // Find the post to make sure it exists
    const post = await Post.findById(postId);
    if (!post) {
      return next(createError(404, "Post not found"));
    }

    const newComment = {
      text,
      userId,
      createdAt: new Date(),
    };

    // Add comment to the post
    post.comments.push(newComment);
    await post.save();

    // Get user details for the comment
    const user = await User.findById(userId);

    // Format the response with user details
    const commentWithUser = {
      ...newComment,
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
      }
    };

    // Emit a socket event for the new comment if socket.io is available
    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.emit("newComment", {
        postId: post._id,
        commentId: newComment._id,
        text: newComment.text,
        userId: newComment.userId,
        postUserId: post.userId,
        postTitle: post.title,
        timestamp: newComment.createdAt,
      });
    }

    res.status(201).json(commentWithUser);
  } catch (err) {
    next(err);
  }
};

// Get user's posts
export const getUserPosts = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const posts = await Post.find({ userId }).sort({ createdAt: -1 });
    
    // Get user details
    const user = await User.findById(userId);
    
    const postsWithUser = posts.map(post => ({
      ...post.toObject(),
      user: {
        id: user?._id,
        username: user?.username,
        avatar: user?.avatar,
      },
    }));
    
    res.status(200).json(postsWithUser);
  } catch (err) {
    next(err);
  }
}; 