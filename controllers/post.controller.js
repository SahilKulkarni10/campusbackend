import prisma from "../lib/prisma.js";
import jwt from "jsonwebtoken";

export const getPosts = async (req, res) => {
  const query = req.query;

  try {
    // Extract pagination parameters
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    
    // Validate pagination parameters
    if (page < 1) {
      return res.status(400).json({ message: "Invalid page parameter" });
    }
    
    if (limit < 1 || limit > 20) {
      return res.status(400).json({ message: "Invalid limit parameter (must be 1-20)" });
    }
    
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter = {
      city: query.city || undefined,
      type: query.type || undefined,
      property: query.property || undefined,
      category: query.category || undefined,
    };

    // Add price range if provided
    if (query.minPrice || query.maxPrice) {
      filter.price = {
        gte: parseInt(query.minPrice) || undefined,
        lte: parseInt(query.maxPrice) || undefined,
      };
    }

    // Clean up the filter by removing undefined values
    Object.keys(filter).forEach(key => {
      if (filter[key] === undefined) {
        delete filter[key];
      }
    });

    // Get total count for pagination info
    const totalCount = await prisma.post.count({
      where: filter
    });
    
    // Check if we have pages beyond available data
    const totalPages = Math.ceil(totalCount / limit);
    if (page > totalPages && totalPages > 0) {
      return res.status(404).json({ message: "Page not found" });
    }

    // Fetch paginated posts with optimized selections
    const posts = await prisma.post.findMany({
      where: filter,
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        price: true,
        images: true,
        address: true,
        city: true,
        college: true,
        venue: true,
        category: true,
        date: true,
        organizer: true,
        attendees: true,
        createdAt: true,
        userId: true,
        user: {
          select: {
            username: true,
            avatar: true,
          },
        },
      }
    });

    // Add pagination headers
    res.set({
      'X-Total-Count': totalCount.toString(),
      'X-Page-Count': totalPages.toString(),
      'X-Current-Page': page.toString(),
      'Cache-Control': 'public, max-age=60' // Cache for 60 seconds
    });

    res.status(200).json(posts);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to get posts" });
  }
};

export const getPostById = async (req, res) => {
  const id = req.params.id;
  try {
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        postDetail: true,
        user: {
          select: {
            username: true,
            avatar: true,
          },
        },
      },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const token = req.cookies?.token;
    let isSaved = false;

    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const saved = await prisma.savedPost.findUnique({
          where: {
            userId_postId: {
              postId: id,
              userId: payload.id,
            },
          },
        });
        isSaved = saved ? true : false;
      } catch (error) {
        // Token verification failed, isSaved remains false
      }
    }

    res.status(200).json({ ...post, isSaved });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to get post" });
  }
};

export const getPostsByCategory = async (req, res) => {
  const { category } = req.params;
  
  try {
    const posts = await prisma.post.findMany({
      where: { 
        category: {
          equals: category,
          mode: 'insensitive' // Case-insensitive search
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        user: {
          select: {
            username: true,
            avatar: true,
          },
        },
      }
    });

    res.status(200).json(posts);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to get posts by category" });
  }
};

export const createPost = async (req, res) => {
  const body = req.body;
  const tokenUserId = req.userId;

  try {
    const newPost = await prisma.post.create({
      data: {
        ...body.postData,
        userId: tokenUserId,
        postDetail: body.postDetail ? {
          create: body.postDetail,
        } : undefined,
      },
    });
    res.status(201).json(newPost);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to create post" });
  }
};

export const updatePost = async (req, res) => {
  const id = req.params.id;
  const updates = req.body;
  const tokenUserId = req.userId;

  try {
    // First check if the post exists and belongs to the user
    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.userId !== tokenUserId) {
      return res.status(403).json({ message: "Not authorized to update this post" });
    }

    // Split updates into post data and post detail data
    const { postDetail, ...postData } = updates;

    // Update the post and its details if provided
    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        ...postData,
        postDetail: postDetail ? {
          upsert: {
            create: postDetail,
            update: postDetail,
          },
        } : undefined,
      },
      include: {
        postDetail: true,
      },
    });

    res.status(200).json(updatedPost);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to update post" });
  }
};

export const deletePost = async (req, res) => {
  const id = req.params.id;
  const tokenUserId = req.userId;

  try {
    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.userId !== tokenUserId) {
      return res.status(403).json({ message: "Not authorized to delete this post" });
    }

    // Delete post detail if exists
    if (post.postDetail) {
      await prisma.postDetail.delete({
        where: { postId: id },
      });
    }

    // Delete the post
    await prisma.post.delete({
      where: { id },
    });

    res.status(200).json({ message: "Post deleted successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to delete post" });
  }
};
