import { Request, Response } from "express";
import prisma from "../../config/database";

export class CommentController {
  // Add Comment (Authenticated Users)
  static async addComment(req: Request, res: Response) {
    try {
      const { blogId, content, parentId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      if (!blogId || !content) {
        return res.status(400).json({
          success: false,
          message: "Blog ID and content are required",
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

      // If parentId provided, check if parent comment exists
      if (parentId) {
        const parentComment = await prisma.comment.findUnique({
          where: { id: parentId },
        });

        if (!parentComment) {
          return res.status(404).json({
            success: false,
            message: "Parent comment not found",
          });
        }
      }

      const comment = await prisma.comment.create({
        data: {
          content,
          blogId,
          authorId: userId,
          parentId: parentId || null,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              studentId: true,
              image: true,
            },
          },
        },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          userId,
          action: "ADD_COMMENT",
          entity: "Comment",
          entityId: comment.id,
          description: `Commented on blog: ${blog.title}`,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return res.status(201).json({
        success: true,
        message: "Comment added successfully",
        data: { comment },
      });
    } catch (error) {
      console.error("Add comment error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while adding the comment",
      });
    }
  }

  // Delete Comment (Admin or Comment Author)
  static async deleteComment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const comment = await prisma.comment.findUnique({
        where: { id },
      });

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: "Comment not found",
        });
      }

      // Check permissions
      if (
        userRole !== "ADMIN" &&
        userRole !== "SUPER_ADMIN" &&
        comment.authorId !== userId
      ) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to delete this comment",
        });
      }

      await prisma.comment.delete({
        where: { id },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          userId,
          action: "DELETE_COMMENT",
          entity: "Comment",
          entityId: id,
          description: "Deleted a comment",
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Comment deleted successfully",
      });
    } catch (error) {
      console.error("Delete comment error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while deleting the comment",
      });
    }
  }

  // Get Comments by Blog (Public)
  static async getCommentsByBlog(req: Request, res: Response) {
    try {
      const { blogId } = req.params;

      const comments = await prisma.comment.findMany({
        where: {
          blogId,
          parentId: null, // Only get top-level comments
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              studentId: true,
              image: true,
            },
          },
          replies: {
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  studentId: true,
                  image: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json({
        success: true,
        data: { comments },
      });
    } catch (error) {
      console.error("Get comments error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching comments",
      });
    }
  }
}
