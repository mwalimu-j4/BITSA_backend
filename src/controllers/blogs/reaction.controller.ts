import { Request, Response } from "express";
import prisma from "../../config/database";

// Note: Assuming `req.user` is extended by the AuthMiddleware to include user data, e.g., req.user.id
export class ReactionController {
  // Add/Update Reaction (Authenticated Users)
  static async toggleReaction(req: Request, res: Response) {
    try {
      const { blogId, type } = req.body;
      const userId = (req as any).user?.id; // Assuming user data is added by a middleware

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      if (!blogId || !type) {
        return res.status(400).json({
          success: false,
          message: "Blog ID and reaction type are required",
        });
      }

      if (!["LIKE", "LOVE", "INSIGHTFUL"].includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid reaction type",
        });
      }

      // Check if blog exists
      const blog = await prisma.blog.findUnique({
        where: { id: blogId },
      });

      if (!blog) {
        return res.status(404).json({
          success: false,
          message: "Blog post not found",
        });
      }

      // Check if user already reacted
      const existingReaction = await prisma.reaction.findUnique({
        where: {
          blogId_userId: {
            blogId,
            userId,
          },
        },
      });

      let reaction;
      let message;

      if (existingReaction) {
        if (existingReaction.type === type) {
          // Remove reaction if same type
          await prisma.reaction.delete({
            where: {
              id: existingReaction.id,
            },
          });
          message = "Reaction removed successfully";
          reaction = null;
        } else {
          // Update reaction if different type
          reaction = await prisma.reaction.update({
            where: {
              id: existingReaction.id,
            },
            data: { type },
          });
          message = "Reaction updated successfully";
        }
      } else {
        // Create new reaction
        reaction = await prisma.reaction.create({
          data: {
            type,
            blogId,
            userId,
          },
        });
        message = "Reaction added successfully";
      }

      // Get updated reaction counts
      const reactionCounts = await prisma.reaction.groupBy({
        by: ["type"],
        where: { blogId },
        _count: { type: true },
      });

      return res.status(200).json({
        success: true,
        message,
        data: {
          reaction,
          counts: reactionCounts,
        },
      });
    } catch (error) {
      console.error("Toggle reaction error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while processing the reaction",
      });
    }
  }

  // Get Reactions by Blog (Public)
  static async getReactionsByBlog(req: Request, res: Response) {
    try {
      const { blogId } = req.params;

      const reactionCounts = await prisma.reaction.groupBy({
        by: ["type"],
        where: { blogId },
        _count: { type: true },
      });

      const userReaction = (req as any).user?.id
        ? await prisma.reaction.findUnique({
            where: {
              blogId_userId: {
                blogId,
                userId: (req as any).user.id,
              },
            },
          })
        : null;

      return res.status(200).json({
        success: true,
        data: {
          counts: reactionCounts,
          userReaction,
        },
      });
    } catch (error) {
      console.error("Get reactions error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching reactions",
      });
    }
  }
}
