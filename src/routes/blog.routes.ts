// src/routes/index.ts or blog.routes.ts
import { Router } from "express";
import { BlogController } from "../controllers/blogs/blog.controller";
import { CategoryController } from "../controllers/blogs/category.controller";
import { CommentController } from "../controllers/blogs/comment.controller";
import { ReactionController } from "../controllers/blogs/reaction.controller";
import { AuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// Blog Routes - IMPORTANT: Specific routes MUST come before dynamic routes!

// 1. Admin-only specific routes (before :slug)
router.get(
  "/blogs/stats",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  BlogController.getBlogStats
);
router.get(
  "/blogs/id/:id",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  BlogController.getBlogById
);

// 2. Public/Student accessible routes
router.get("/blogs", AuthMiddleware.optionalAuth, BlogController.getAllBlogs);

// 3. Dynamic slug route MUST be last (catches any string)
router.get(
  "/blogs/:slug",
  AuthMiddleware.optionalAuth,
  BlogController.getBlogBySlug
);
router.post(
  "/blogs",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  BlogController.createBlog
);
router.put(
  "/blogs/:id",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  BlogController.updateBlog
);
router.delete(
  "/blogs/:id",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  BlogController.deleteBlog
);
router.patch(
  "/blogs/:id/toggle-publish",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  BlogController.togglePublish
);

// Category Routes
router.get("/categories", CategoryController.getAllCategories);
router.post(
  "/categories",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  CategoryController.createCategory
);
router.put(
  "/categories/:id",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  CategoryController.updateCategory
);
router.delete(
  "/categories/:id",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  CategoryController.deleteCategory
);

// Comment Routes - Students can add/delete their own comments
router.get("/comments/blog/:blogId", CommentController.getCommentsByBlog);
router.post(
  "/comments",
  AuthMiddleware.authenticate,
  CommentController.addComment
);
router.delete(
  "/comments/:id",
  AuthMiddleware.authenticate,
  CommentController.deleteComment
);

// Reaction Routes - Students can react to blogs
router.get(
  "/reactions/blog/:blogId",
  AuthMiddleware.optionalAuth,
  ReactionController.getReactionsByBlog
);
router.post(
  "/reactions",
  AuthMiddleware.authenticate,
  ReactionController.toggleReaction
);

export default router;
