// src/routes/blog.routes.ts
import { Router } from "express";
import { BlogController } from "../controllers/blogs/blog.controller";
import { CategoryController } from "../controllers/blogs/category.controller";
import { CommentController } from "../controllers/blogs/comment.controller";
import { ReactionController } from "../controllers/blogs/reaction.controller";
import { AuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// ============================================
// CRITICAL: Route Order Matters!
// Specific routes MUST come before dynamic routes
// ============================================

// ============================================
// BLOG ROUTES
// ============================================

// 1. Admin-only specific routes (BEFORE dynamic :slug and :id)
router.get(
  "/blogs/stats",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  BlogController.getBlogStats
);

// 2. Public list endpoint (BEFORE :slug to avoid conflict)
router.get("/blogs", AuthMiddleware.optionalAuth, BlogController.getAllBlogs);

// 3. Get blog by ID for editing (BEFORE :slug, use /id/:id prefix)
router.get(
  "/blogs/id/:id",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  BlogController.getBlogById
);

// 4. Dynamic slug route MUST be LAST (catches any string after /blogs/)
router.get(
  "/blogs/:slug",
  AuthMiddleware.optionalAuth,
  BlogController.getBlogBySlug
);

// 5. Create, Update, Delete operations
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

// ============================================
// CATEGORY ROUTES
// ============================================

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

// ============================================
// COMMENT ROUTES - Students can add/delete their own comments
// ============================================

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

// ============================================
// REACTION ROUTES - Students can react to blogs
// ============================================

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
