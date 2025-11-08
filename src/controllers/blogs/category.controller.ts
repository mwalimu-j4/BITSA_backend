import { Request, Response } from "express";
import prisma from "../../config/database";

export class CategoryController {
  // Create Category (Admin Only)
  static async createCategory(req: Request, res: Response) {
    try {
      const { name, description } = req.body;
      const userId = req.user?.id;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Category name is required",
        });
      }

      const slug = name.toLowerCase().replace(/\s+/g, "-");

      // Check if category exists
      const existingCategory = await prisma.category.findUnique({
        where: { slug },
      });

      if (existingCategory) {
        return res.status(409).json({
          success: false,
          message: "Category already exists",
        });
      }

      const category = await prisma.category.create({
        data: {
          name,
          slug,
          description,
        },
      });

      // Log activity
      if (userId) {
        await prisma.activity.create({
          data: {
            userId,
            action: "CREATE_CATEGORY",
            entity: "Category",
            entityId: category.id,
            description: `Created category: ${name}`,
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || null,
          },
        });
      }

      return res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: { category },
      });
    } catch (error) {
      console.error("Create category error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while creating the category",
      });
    }
  }

  // Get All Categories (Public)
  static async getAllCategories(req: Request, res: Response) {
    try {
      const categories = await prisma.category.findMany({
        include: {
          _count: {
            select: {
              blogs: true,
              events: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });

      return res.status(200).json({
        success: true,
        data: { categories },
      });
    } catch (error) {
      console.error("Get categories error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching categories",
      });
    }
  }

  // Update Category (Admin Only)
  static async updateCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      const userId = req.user?.id;

      const existingCategory = await prisma.category.findUnique({
        where: { id },
      });

      if (!existingCategory) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      const slug = name
        ? name.toLowerCase().replace(/\s+/g, "-")
        : existingCategory.slug;

      const category = await prisma.category.update({
        where: { id },
        data: {
          name: name || existingCategory.name,
          slug,
          description:
            description !== undefined
              ? description
              : existingCategory.description,
        },
      });

      // Log activity
      if (userId) {
        await prisma.activity.create({
          data: {
            userId,
            action: "UPDATE_CATEGORY",
            entity: "Category",
            entityId: id,
            description: `Updated category: ${category.name}`,
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || null,
          },
        });
      }

      return res.status(200).json({
        success: true,
        message: "Category updated successfully",
        data: { category },
      });
    } catch (error) {
      console.error("Update category error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while updating the category",
      });
    }
  }

  // Delete Category (Admin Only)
  static async deleteCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              blogs: true,
              events: true,
            },
          },
        },
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      // Check if category has blogs or events
      if (category._count.blogs > 0 || category._count.events > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete category. It has ${category._count.blogs} blog(s) and ${category._count.events} event(s) associated with it.`,
        });
      }

      await prisma.category.delete({
        where: { id },
      });

      // Log activity
      if (userId) {
        await prisma.activity.create({
          data: {
            userId,
            action: "DELETE_CATEGORY",
            entity: "Category",
            entityId: id,
            description: `Deleted category: ${category.name}`,
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || null,
          },
        });
      }

      return res.status(200).json({
        success: true,
        message: "Category deleted successfully",
      });
    } catch (error) {
      console.error("Delete category error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while deleting the category",
      });
    }
  }
}
