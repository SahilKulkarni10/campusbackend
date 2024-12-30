// import prisma from "../lib/prisma.js";

// export const addMessage = async (req, res) => {
//   const tokenUserId = req.userId;
//   const chatId = req.params.chatId;
//   const text = req.body.text;

//   try {
//     const chat = await prisma.chat.findUnique({
//       where: {
//         id: chatId,
//         userIDs: {
//           hasSome: [tokenUserId],
//         },
//       },
//     });

//     if (!chat) return res.status(404).json({ message: "Chat not found!" });

//     const message = await prisma.message.create({
//       data: {
//         text,
//         chatId,
//         userId: tokenUserId,
//       },
//     });

//     await prisma.chat.update({
//       where: {
//         id: chatId,
//       },
//       data: {
//         seenBy: [tokenUserId],
//         lastMessage: text,
//       },
//     });

//     res.status(200).json(message);
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ message: "Failed to add message!" });
//   }
// };

import prisma from "../lib/prisma.js";

/**
 * Add a new message to a chat.
 */
export const addMessage = async (req, res) => {
  const tokenUserId = req.userId; // The user sending the message
  const chatId = req.params.chatId; // ID of the chat
  const text = req.body.text; // Message content

  try {
    // Validate input
    if (!text || text.trim() === "") {
      return res.status(400).json({ message: "Message text cannot be empty!" });
    }

    // Check if the chat exists and the user is a participant
    const chat = await prisma.chat.findUnique({
      where: {
        id: chatId,
      },
      select: {
        userIDs: true,
      },
    });

    if (!chat || !chat.userIDs.includes(tokenUserId)) {
      return res.status(404).json({ message: "Chat not found or access denied!" });
    }

    // Add the message to the database
    const message = await prisma.message.create({
      data: {
        text,
        chatId,
        userId: tokenUserId,
      },
    });

    // Update the chat: set "seenBy" to the sender and update the last message
    await prisma.chat.update({
      where: {
        id: chatId,
      },
      data: {
        seenBy: {
          set: [tokenUserId], // Reset "seenBy" for the sender
        },
        lastMessage: text,
      },
    });

    // Notify other users in the chat (placeholder for notification logic)
    chat.userIDs
      .filter((id) => id !== tokenUserId)
      .forEach((userId) => {
        // Add your notification logic here, e.g., WebSocket or push notification
        console.log(`Notified user ${userId} about the new message.`);
      });

    // Respond with the created message
    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add message!" });
  }
};
