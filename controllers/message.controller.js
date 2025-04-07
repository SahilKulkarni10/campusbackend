import prisma from "../lib/prisma.js";

export const addMessage = async (req, res) => {
  const tokenUserId = req.userId;
  const chatId = req.params.chatId;
  const text = req.body.text;

  if (!text) {
    return res.status(400).json({ message: "Message text is required" });
  }

  try {
    const chat = await prisma.chat.findUnique({
      where: {
        id: chatId,
        userIDs: {
          hasSome: [tokenUserId],
        },
      },
    });

    if (!chat) return res.status(404).json({ message: "Chat not found!" });

    const message = await prisma.message.create({
      data: {
        text,
        chatId,
        userId: tokenUserId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      }
    });
    
    // Format the response to include user details
    const formattedMessage = {
      id: message.id,
      text: message.text,
      userId: message.userId,
      chatId: message.chatId,
      createdAt: message.createdAt,
      username: message.user?.username,
      avatar: message.user?.avatar
    };

    return res.status(201).json(formattedMessage);
  } catch (error) {
    console.error("Error creating message:", error);
    return res.status(500).json({ message: "Error creating message!", error: error.message });
  }
};

export const getMessages = async (req, res) => {
  const tokenUserId = req.userId;
  const chatId = req.params.chatId;

  try {
    // Verify user has access to this chat
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        userIDs: {
          hasSome: [tokenUserId],
        },
      },
    });

    if (!chat) return res.status(404).json({ message: "Chat not found!" });

    const messages = await prisma.message.findMany({
      where: {
        chatId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return res.status(200).json(messages);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching messages!", error: error.message });
  }
};

// General chat functions
export const getGeneralChatMessages = async (req, res) => {
  try {
    // Find the general chat id or create it if it doesn't exist
    let generalChat = await prisma.generalChat.findFirst();
    
    if (!generalChat) {
      generalChat = await prisma.generalChat.create({
        data: {
          name: "General Campus Chat"
        }
      });
    }
    
    // Get messages from the general chat
    const messages = await prisma.generalChatMessage.findMany({
      orderBy: {
        createdAt: "asc"
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      }
    });
    
    // Transform messages to include user information directly
    const formattedMessages = messages.map(message => ({
      id: message.id,
      text: message.text,
      userId: message.userId,
      username: message.user.username,
      avatar: message.user.avatar,
      createdAt: message.createdAt
    }));
    
    return res.status(200).json(formattedMessages);
  } catch (error) {
    console.error("Error fetching general chat messages:", error);
    return res.status(500).json({ message: "Error fetching general chat messages!", error: error.message });
  }
};

export const addGeneralChatMessage = async (req, res) => {
  const tokenUserId = req.userId;
  const { text } = req.body;
  
  if (!text) {
    return res.status(400).json({ message: "Message text is required" });
  }
  
  try {
    // Find the general chat or create it if it doesn't exist
    let generalChat = await prisma.generalChat.findFirst();
    
    if (!generalChat) {
      generalChat = await prisma.generalChat.create({
        data: {
          name: "General Campus Chat"
        }
      });
    }
    
    // Get user info for response
    const user = await prisma.user.findUnique({
      where: { id: tokenUserId },
      select: {
        id: true,
        username: true,
        avatar: true
      }
    });
    
    // Create the message
    const message = await prisma.generalChatMessage.create({
      data: {
        text,
        userId: tokenUserId,
        generalChatId: generalChat.id
      }
    });
    
    // Format response with user info
    const formattedMessage = {
      id: message.id,
      text: message.text,
      userId: message.userId,
      username: user.username,
      avatar: user.avatar,
      createdAt: message.createdAt
    };
    
    return res.status(201).json(formattedMessage);
  } catch (error) {
    console.error("Error adding general chat message:", error);
    return res.status(500).json({ message: "Error adding message!", error: error.message });
  }
};
