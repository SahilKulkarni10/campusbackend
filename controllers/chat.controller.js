import prisma from "../lib/prisma.js";

/**
 * Get all chats for the logged-in user.
 */
export const getChats = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    // Fetch all chats involving the user through the junction table
    const userChats = await prisma.userChat.findMany({
      where: {
        userId: tokenUserId,
      },
      include: {
        chat: {
          include: {
            messages: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 1, // Get only the most recent message
            },
          },
        },
      },
    });

    // Extract the chat objects and transform them
    const chatResults = await Promise.all(
      userChats.map(async (userChat) => {
        const chat = userChat.chat;
        
        // Find the other user in the chat (the receiver)
        const otherUserChat = await prisma.userChat.findFirst({
          where: {
            chatId: chat.id,
            userId: {
              not: tokenUserId,
            },
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        });

        // Get the last message text
        const lastMessage = chat.messages.length > 0 
          ? chat.messages[0].text 
          : chat.lastMessage || '';

        return {
          id: chat.id,
          receiver: otherUserChat?.user || { id: '', username: 'Unknown', avatar: null },
          lastMessage,
          seenBy: chat.seenBy || [],
          createdAt: chat.createdAt,
          messages: [], // Empty array as we'll fetch messages separately
        };
      })
    );

    res.status(200).json(chatResults);
  } catch (err) {
    console.error("Error getting chats:", err);
    res.status(500).json({ message: "Failed to get chats" });
  }
};

/**
 * Get a specific chat by ID with messages.
 */
export const getChat = async (req, res) => {
  const tokenUserId = req.userId;
  const chatId = req.params.id;

  try {
    // Check if the user is part of this chat
    const userChat = await prisma.userChat.findFirst({
      where: {
        chatId,
        userId: tokenUserId,
      },
    });

    if (!userChat) {
      return res.status(403).json({ message: "You don't have access to this chat" });
    }

    // Get the chat with messages
    const chat = await prisma.chat.findUnique({
      where: {
        id: chatId,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // Get receiver info
    const receiverChat = await prisma.userChat.findFirst({
      where: {
        chatId,
        userId: {
          not: tokenUserId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Update the seenBy field to include current user
    if (!chat.seenBy.includes(tokenUserId)) {
      await prisma.chat.update({
        where: {
          id: chatId,
        },
        data: {
          seenBy: {
            push: tokenUserId,
          },
        },
      });
    }

    // Construct the response
    const response = {
      id: chat.id,
      messages: chat.messages,
      seenBy: chat.seenBy,
      createdAt: chat.createdAt,
      receiver: receiverChat?.user || { id: '', username: 'Unknown', avatar: null },
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("Error getting chat:", err);
    res.status(500).json({ message: "Failed to get chat" });
  }
};

/**
 * Create a new chat between two users.
 */
export const addChat = async (req, res) => {
  const { receiverId } = req.body;
  const senderId = req.userId;

  if (!receiverId) {
    return res.status(400).json({ message: "Receiver ID is required" });
  }

  try {
    // Check if the receiver exists
    const receiver = await prisma.user.findUnique({
      where: {
        id: receiverId,
      },
    });

    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    // Check if a chat already exists between these two users
    const existingChats = await prisma.userChat.findMany({
      where: {
        userId: senderId,
      },
      include: {
        chat: {
          include: {
            userChats: {
              where: {
                userId: receiverId,
              },
            },
          },
        },
      },
    });

    const existingChat = existingChats.find(
      (userChat) => userChat.chat.userChats.length > 0
    );

    if (existingChat) {
      return res.status(200).json({ id: existingChat.chatId });
    }

    // Create a new chat
    const newChat = await prisma.chat.create({
      data: {
        userIDs: [senderId, receiverId],
        seenBy: [senderId],
        userChats: {
          create: [
            { userId: senderId },
            { userId: receiverId },
          ],
        },
      },
    });

    res.status(201).json({ id: newChat.id });
  } catch (err) {
    console.error("Error adding chat:", err);
    res.status(500).json({ message: "Failed to create chat" });
  }
};

/**
 * Mark a chat as read by the current user.
 */
export const readChat = async (req, res) => {
  const tokenUserId = req.userId;
  const chatId = req.params.id;

  try {
    // Check if the user is part of this chat
    const userChat = await prisma.userChat.findFirst({
      where: {
        chatId,
        userId: tokenUserId,
      },
    });

    if (!userChat) {
      return res.status(403).json({ message: "You don't have access to this chat" });
    }

    // Get the current chat
    const chat = await prisma.chat.findUnique({
      where: {
        id: chatId,
      },
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // Update the seenBy field
    const updatedSeenBy = Array.isArray(chat.seenBy) 
      ? [...new Set([...chat.seenBy, tokenUserId])] 
      : [tokenUserId];

    await prisma.chat.update({
      where: {
        id: chatId,
      },
      data: {
        seenBy: updatedSeenBy,
      },
    });

    res.status(200).json({ message: "Chat marked as read" });
  } catch (err) {
    console.error("Error marking chat as read:", err);
    res.status(500).json({ message: "Failed to mark chat as read" });
  }
};
