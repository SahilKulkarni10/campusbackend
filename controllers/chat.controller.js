// import prisma from "../lib/prisma.js";

// export const getChats = async (req, res) => {
//   const tokenUserId = req.userId;

//   try {
//     const chats = await prisma.chat.findMany({
//       where: {
//         userIDs: {
//           hasSome: [tokenUserId],
//         },
//       },
//     });

//     for (const chat of chats) {
//       const receiverId = chat.userIDs.find((id) => id !== tokenUserId);

//       const receiver = await prisma.user.findUnique({
//         where: {
//           id: receiverId,
//         },
//         select: {
//           id: true,
//           username: true,
//           avatar: true,
//         },
//       });
//       chat.receiver = receiver;
//     }

//     res.status(200).json(chats);
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ message: "Failed to get chats!" });
//   }
// };

// export const getChat = async (req, res) => {
//   const tokenUserId = req.userId;

//   try {
//     const chat = await prisma.chat.findUnique({
//       where: {
//         id: req.params.id,
//         userIDs: {
//           hasSome: [tokenUserId],
//         },
//       },
//       include: {
//         messages: {
//           orderBy: {
//             createdAt: "asc",
//           },
//         },
//       },
//     });

//     await prisma.chat.update({
//       where: {
//         id: req.params.id,
//       },
//       data: {
//         seenBy: {
//           push: [tokenUserId],
//         },
//       },
//     });
//     res.status(200).json(chat);
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ message: "Failed to get chat!" });
//   }
// };

// export const addChat = async (req, res) => {
//   const tokenUserId = req.userId;
//   try {
//     const newChat = await prisma.chat.create({
//       data: {
//         userIDs: [tokenUserId, req.body.receiverId],
//       },
//     });
//     res.status(200).json(newChat);
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ message: "Failed to add chat!" });
//   }
// };

// export const readChat = async (req, res) => {
//   const tokenUserId = req.userId;

  
//   try {
//     const chat = await prisma.chat.update({
//       where: {
//         id: req.params.id,
//         userIDs: {
//           hasSome: [tokenUserId],
//         },
//       },
//       data: {
//         seenBy: {
//           set: [tokenUserId],
//         },
//       },
//     });
//     res.status(200).json(chat);
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ message: "Failed to read chat!" });
//   }
// };
import prisma from "../lib/prisma.js";

/**
 * Get all chats for the logged-in user.
 */
export const getChats = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    // Fetch all chats involving the user
    const chats = await prisma.chat.findMany({
      where: {
        userIDs: {
          hasSome: [tokenUserId],
        },
      },
      include: {
        messages: {
          select: {
            text: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1, // Fetch only the last message for summary
        },
      },
    });

    // Enrich chats with receiver information
    const enrichedChats = await Promise.all(
      chats.map(async (chat) => {
        const receiverId = chat.userIDs.find((id) => id !== tokenUserId);
        const receiver = await prisma.user.findUnique({
          where: {
            id: receiverId,
          },
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        });

        return {
          ...chat,
          receiver,
        };
      })
    );

    res.status(200).json(enrichedChats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get chats!" });
  }
};

/**
 * Get a specific chat by ID.
 */
export const getChat = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    // Fetch the chat with messages
    const chat = await prisma.chat.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!chat || !chat.userIDs.includes(tokenUserId)) {
      return res.status(404).json({ message: "Chat not found or access denied!" });
    }

    // Update "seenBy" field for the chat
    await prisma.chat.update({
      where: {
        id: req.params.id,
      },
      data: {
        seenBy: {
          push: tokenUserId,
        },
      },
    });

    res.status(200).json(chat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get chat!" });
  }
};

/**
 * Create a new chat between two users.
 */
export const addChat = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    // Prevent duplicate chats between the same users
    const existingChat = await prisma.chat.findFirst({
      where: {
        userIDs: {
          hasEvery: [tokenUserId, req.body.receiverId],
        },
      },
    });

    if (existingChat) {
      return res.status(400).json({ message: "Chat already exists!" });
    }

    // Create a new chat
    const newChat = await prisma.chat.create({
      data: {
        userIDs: [tokenUserId, req.body.receiverId],
      },
    });

    res.status(201).json(newChat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add chat!" });
  }
};

/**
 * Mark a chat as read for the logged-in user.
 */
export const readChat = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    const chat = await prisma.chat.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!chat || !chat.userIDs.includes(tokenUserId)) {
      return res.status(404).json({ message: "Chat not found or access denied!" });
    }

    // Mark the chat as read
    const updatedChat = await prisma.chat.update({
      where: {
        id: req.params.id,
      },
      data: {
        seenBy: {
          push: tokenUserId,
        },
      },
    });

    res.status(200).json(updatedChat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to mark chat as read!" });
  }
};
