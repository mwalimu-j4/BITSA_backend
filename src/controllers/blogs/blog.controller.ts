import { Request, Response } from "express";
import prisma from "../../config/database";
import {
  CreateBlogData,
  UpdateBlogData,
  BlogFilters,
} from "../../types/blog.types";

export class BlogController {
  // Get Single Blog by Slug (Public)
  static async getBlogBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params;

      console.log("🔍 Fetching blog with slug:", slug);
      console.log("🔐 User:", req.user?.id, "Role:", req.user?.role);

      const blog = await prisma.blog.findUnique({
        where: { slug },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              studentId: true,
              image: true,
              role: true,
            },
          },
          category: true,
          tags: true,
          comments: {
            where: { parentId: null },
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
          },
          reactions: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  studentId: true,
                },
              },
            },
          },
          _count: {
            select: {
              comments: true,
              reactions: true,
            },
          },
        },
      });

      if (!blog) {
        console.log("❌ Blog not found with slug:", slug);
        return res.status(404).json({
          success: false,
          message: "Blog post not found",
        });
      }

      console.log("✅ Blog found:", blog.id, blog.title);

      // Check if user can view unpublished posts
      if (
        !blog.published &&
        req.user?.role !== "ADMIN" &&
        req.user?.role !== "SUPER_ADMIN" &&
        req.user?.id !== blog.authorId
      ) {
        console.log("⚠️ Blog is not published and user cannot view");
        return res.status(403).json({
          success: false,
          message: "This blog post is not published yet",
        });
      }

      // Get reaction counts grouped by type
      const reactionCounts = await prisma.reaction.groupBy({
        by: ["type"],
        where: { blogId: blog.id },
        _count: { type: true },
      });

      console.log("📊 Reaction counts:", reactionCounts);

      // Get user's reaction if authenticated
      let userReaction = null;
      if (req.user?.id) {
        userReaction = await prisma.reaction.findUnique({
          where: {
            blogId_userId: {
              blogId: blog.id,
              userId: req.user.id,
            },
          },
        });
        console.log("👤 User reaction:", userReaction);
      }

      // Increment views
      await prisma.blog.update({
        where: { id: blog.id },
        data: { views: { increment: 1 } },
      });

      console.log("✅ Sending blog data with reactions");

      return res.status(200).json({
        success: true,
        data: {
          blog: {
            ...blog,
            reactionCounts,
            userReaction,
          },
        },
      });
    } catch (error) {
      console.error("❌ Get blog by slug error:", error);
      console.error("Error details:", {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack,
      });
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching the blog post",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  }

  // Get Blog by ID (Admin)
  static async getBlogById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      console.log("🔍 Fetching blog by ID:", id);

      const blog = await prisma.blog.findUnique({
        where: { id },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              studentId: true,
              image: true,
            },
          },
          category: true,
          tags: true,
          comments: {
            where: { parentId: null },
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
          },
          reactions: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  studentId: true,
                },
              },
            },
          },
          _count: {
            select: {
              comments: true,
              reactions: true,
            },
          },
        },
      });

      if (!blog) {
        console.log("❌ Blog not found with ID:", id);
        return res.status(404).json({
          success: false,
          message: "Blog post not found",
        });
      }

      // Get reaction counts grouped by type
      const reactionCounts = await prisma.reaction.groupBy({
        by: ["type"],
        where: { blogId: id },
        _count: { type: true },
      });

      console.log("✅ Blog found by ID:", blog.id);

      return res.status(200).json({
        success: true,
        data: {
          blog: {
            ...blog,
            reactionCounts,
          },
        },
      });
    } catch (error) {
      console.error("❌ Get blog by ID error:", error);
      console.error("Error details:", {
        name: (error as Error).name,
        message: (error as Error).message,
      });
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching the blog post",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  }

  // Get All Blogs (Public - with filters)
  static async getAllBlogs(req: Request, res: Response) {
    try {
      const {
        search,
        categoryId,
        authorId,
        published,
        tags,
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query as any;

      console.log("🔍 Fetching all blogs with filters:", {
        search,
        categoryId,
        published,
        page,
        limit,
        userRole: req.user?.role,
      });

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Build where clause
      const where: any = {};

      // If user is not admin, only show published posts
      if (req.user?.role !== "ADMIN" && req.user?.role !== "SUPER_ADMIN") {
        where.published = true;
        console.log("👤 Non-admin user: filtering for published blogs only");
      } else if (published !== undefined) {
        where.published = published === "true";
        console.log("👑 Admin user: filtering by published:", published);
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { content: { contains: search, mode: "insensitive" } },
          { excerpt: { contains: search, mode: "insensitive" } },
        ];
      }

      if (categoryId) {
        where.categoryId = categoryId;
      }

      if (authorId) {
        where.authorId = authorId;
      }

      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        where.tags = {
          some: {
            name: { in: tagArray },
          },
        };
      }

      // Get total count
      const total = await prisma.blog.count({ where });
      console.log("📊 Total blogs found:", total);

      // Get blogs with all related data
      const blogs = await prisma.blog.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              studentId: true,
              image: true,
            },
          },
          category: true,
          tags: true,
          _count: {
            select: {
              comments: true,
              reactions: true,
            },
          },
        },
      });

      console.log("✅ Fetched", blogs.length, "blogs");

      // Get reaction counts for each blog
      const blogsWithReactions = await Promise.all(
        blogs.map(async (blog) => {
          const reactionCounts = await prisma.reaction.groupBy({
            by: ["type"],
            where: { blogId: blog.id },
            _count: { type: true },
          });

          return {
            ...blog,
            reactionCounts,
          };
        })
      );

      console.log("✅ Added reaction counts to all blogs");

      return res.status(200).json({
        success: true,
        data: {
          blogs: blogsWithReactions,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit)),
          },
        },
      });
    } catch (error) {
      console.error("❌ Get all blogs error:", error);
      console.error("Error details:", {
        name: (error as Error).name,
        message: (error as Error).message,
      });
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching blogs",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  }

  // Create Blog Post (Admin Only)
  static async createBlog(req: Request<{}, {}, CreateBlogData>, res: Response) {
    try {
      const {
        title,
        content,
        excerpt,
        coverImage,
        published,
        categoryId,
        tags,
      } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      // Validation
      if (!title || !content) {
        return res.status(400).json({
          success: false,
          message: "Title and content are required",
        });
      }

      // Generate slug from title
      const slug =
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") +
        "-" +
        Date.now();

      // Handle tags
      let tagConnections = undefined;
      if (tags && tags.length > 0) {
        tagConnections = {
          connectOrCreate: tags.map((tagName) => ({
            where: {
              name: tagName.trim().toLowerCase(),
            },
            create: {
              name: tagName.trim().toLowerCase(),
              slug: tagName.trim().toLowerCase().replace(/\s+/g, "-"),
            },
          })),
        };
      }

      const blog = await prisma.blog.create({
        data: {
          title,
          slug,
          content,
          excerpt: excerpt || content.substring(0, 200) + "...",
          coverImage,
          published: published || false,
          publishedAt: published ? new Date() : null,
          authorId: userId,
          categoryId: categoryId || null,
          tags: tagConnections,
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
          category: true,
          tags: true,
          _count: {
            select: {
              comments: true,
              reactions: true,
            },
          },
        },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          userId,
          action: "CREATE_BLOG",
          entity: "Blog",
          entityId: blog.id,
          description: `Created blog post: ${title}`,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return res.status(201).json({
        success: true,
        message: "Blog post created successfully",
        data: { blog },
      });
    } catch (error) {
      console.error("Create blog error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while creating the blog post",
      });
    }
  }

  // Update Blog (Admin Only or Author)
  static async updateBlog(
    req: Request<{ id: string }, {}, UpdateBlogData>,
    res: Response
  ) {
    try {
      const { id } = req.params;
      const {
        title,
        content,
        excerpt,
        coverImage,
        published,
        categoryId,
        tags,
      } = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      // Find existing blog
      const existingBlog = await prisma.blog.findUnique({
        where: { id },
      });

      if (!existingBlog) {
        return res.status(404).json({
          success: false,
          message: "Blog post not found",
        });
      }

      // Check permissions: Admin or Author
      if (
        userRole !== "ADMIN" &&
        userRole !== "SUPER_ADMIN" &&
        existingBlog.authorId !== userId
      ) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to update this blog post",
        });
      }

      // Update slug if title changed
      let newSlug = existingBlog.slug;
      if (title && title !== existingBlog.title) {
        newSlug =
          title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "") +
          "-" +
          Date.now();
      }

      // Handle tags
      let tagOperations = undefined;
      if (tags) {
        tagOperations = {
          set: [], // Disconnect all existing tags
          connectOrCreate: tags.map((tagName) => ({
            where: {
              name: tagName.trim().toLowerCase(),
            },
            create: {
              name: tagName.trim().toLowerCase(),
              slug: tagName.trim().toLowerCase().replace(/\s+/g, "-"),
            },
          })),
        };
      }

      const updateData: any = {
        title,
        slug: newSlug,
        content,
        excerpt,
        coverImage,
        categoryId: categoryId === null ? null : categoryId,
      };

      // Handle published status
      if (published !== undefined) {
        updateData.published = published;
        if (published && !existingBlog.published) {
          updateData.publishedAt = new Date();
        }
      }

      if (tagOperations) {
        updateData.tags = tagOperations;
      }

      const blog = await prisma.blog.update({
        where: { id },
        data: updateData,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              studentId: true,
              image: true,
            },
          },
          category: true,
          tags: true,
          _count: {
            select: {
              comments: true,
              reactions: true,
            },
          },
        },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          userId,
          action: "UPDATE_BLOG",
          entity: "Blog",
          entityId: blog.id,
          description: `Updated blog post: ${blog.title}`,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Blog post updated successfully",
        data: { blog },
      });
    } catch (error) {
      console.error("Update blog error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while updating the blog post",
      });
    }
  }

  // Delete Blog (Admin Only)
  static async deleteBlog(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const blog = await prisma.blog.findUnique({
        where: { id },
      });

      if (!blog) {
        return res.status(404).json({
          success: false,
          message: "Blog post not found",
        });
      }

      await prisma.blog.delete({
        where: { id },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          userId,
          action: "DELETE_BLOG",
          entity: "Blog",
          entityId: id,
          description: `Deleted blog post: ${blog.title}`,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Blog post deleted successfully",
      });
    } catch (error) {
      console.error("Delete blog error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while deleting the blog post",
      });
    }
  }

  // Toggle Publish Status (Admin Only)
  static async togglePublish(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const blog = await prisma.blog.findUnique({
        where: { id },
      });

      if (!blog) {
        return res.status(404).json({
          success: false,
          message: "Blog post not found",
        });
      }

      const updatedBlog = await prisma.blog.update({
        where: { id },
        data: {
          published: !blog.published,
          publishedAt: !blog.published ? new Date() : blog.publishedAt,
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
          category: true,
          tags: true,
          _count: {
            select: {
              comments: true,
              reactions: true,
            },
          },
        },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          userId,
          action: updatedBlog.published ? "PUBLISH_BLOG" : "UNPUBLISH_BLOG",
          entity: "Blog",
          entityId: id,
          description: `${
            updatedBlog.published ? "Published" : "Unpublished"
          } blog post: ${blog.title}`,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return res.status(200).json({
        success: true,
        message: `Blog post ${
          updatedBlog.published ? "published" : "unpublished"
        } successfully`,
        data: { blog: updatedBlog },
      });
    } catch (error) {
      console.error("Toggle publish error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while updating the blog post",
      });
    }
  }

  // Get Blog Statistics (Admin Only)
  static async getBlogStats(req: Request, res: Response) {
    try {
      const totalBlogs = await prisma.blog.count();
      const publishedBlogs = await prisma.blog.count({
        where: { published: true },
      });
      const draftBlogs = await prisma.blog.count({
        where: { published: false },
      });
      const totalViews = await prisma.blog.aggregate({
        _sum: { views: true },
      });
      const totalComments = await prisma.comment.count();
      const totalReactions = await prisma.reaction.count();

      // Most viewed blogs
      const mostViewedBlogs = await prisma.blog.findMany({
        take: 5,
        orderBy: { views: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          views: true,
          createdAt: true,
        },
      });

      // Recent blogs
      const recentBlogs = await prisma.blog.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          published: true,
          createdAt: true,
          author: {
            select: {
              name: true,
              studentId: true,
            },
          },
        },
      });

      return res.status(200).json({
        success: true,
        data: {
          stats: {
            totalBlogs,
            publishedBlogs,
            draftBlogs,
            totalViews: totalViews._sum.views || 0,
            totalComments,
            totalReactions,
          },
          mostViewedBlogs,
          recentBlogs,
        },
      });
    } catch (error) {
      console.error("Get blog stats error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching blog statistics",
      });
    }
  }
}
