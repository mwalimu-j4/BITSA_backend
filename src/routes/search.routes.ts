// backend/src/routes/search.routes.ts
import { Router } from "express";
import { AuthMiddleware } from "../middlewares/auth.middleware";
import prisma from "../config/database";

const router = Router();

// Global search endpoint
router.get("/global", AuthMiddleware, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || typeof q !== "string" || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
      }
      
    const searchQuery = q.trim();
    const limitNum = parseInt(limit as string) || 10;

    // Search blogs
    const blogs = await prisma.blog.findMany({
      where: {
        published: true,
        OR: [
          { title: { contains: searchQuery, mode: "insensitive" } },
          { excerpt: { contains: searchQuery, mode: "insensitive" } },
          { content: { contains: searchQuery, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        featuredImage: true,
        createdAt: true,
        category: {
          select: {
            name: true,
          },
        },
      },
      take: limitNum,
      orderBy: { createdAt: "desc" },
    });

    // Search events
    const events = await prisma.event.findMany({
      where: {
        published: true,
        OR: [
          { title: { contains: searchQuery, mode: "insensitive" } },
          { description: { contains: searchQuery, mode: "insensitive" } },
          { location: { contains: searchQuery, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        coverImage: true,
        location: true,
        startDate: true,
        eventType: true,
        status: true,
      },
      take: limitNum,
      orderBy: { startDate: "desc" },
    });

    // Search gallery
    const gallery = await prisma.gallery.findMany({
      where: {
        published: true,
        OR: [
          { title: { contains: searchQuery, mode: "insensitive" } },
          { description: { contains: searchQuery, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        images: true,
        eventDate: true,
      },
      take: limitNum,
      orderBy: { eventDate: "desc" },
    });

    const totalResults = blogs.length + events.length + gallery.length;

    return res.json({
      success: true,
      data: {
        blogs,
        events,
        gallery,
        total: totalResults,
      },
    });
  } catch (error) {
    console.error("Global search error:", error);
    return res.status(500).json({
      success: false,
      message: "Search failed",
    });
  }
});

// Advanced search with filters
router.get("/advanced", AuthMiddleware, async (req, res) => {
  try {
    const {
      q,
      type, // 'blog', 'event', 'gallery', or 'all'
      category,
      dateFrom,
      dateTo,
      limit = 20,
      page = 1,
    } = req.query;

    if (!q || typeof q !== "string" || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    const searchQuery = q.trim();
    const limitNum = parseInt(limit as string) || 20;
    const pageNum = parseInt(page as string) || 1;
    const skip = (pageNum - 1) * limitNum;

    const results: any = {
      blogs: [],
      events: [],
      gallery: [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: 0,
      },
    };

    // Search blogs if type is 'blog' or 'all'
    if (!type || type === "all" || type === "blog") {
      const blogWhere: any = {
        published: true,
        OR: [
          { title: { contains: searchQuery, mode: "insensitive" } },
          { excerpt: { contains: searchQuery, mode: "insensitive" } },
          { content: { contains: searchQuery, mode: "insensitive" } },
        ],
      };

      if (category) {
        blogWhere.categoryId = category;
      }

      if (dateFrom || dateTo) {
        blogWhere.createdAt = {};
        if (dateFrom) blogWhere.createdAt.gte = new Date(dateFrom as string);
        if (dateTo) blogWhere.createdAt.lte = new Date(dateTo as string);
      }

      results.blogs = await prisma.blog.findMany({
        where: blogWhere,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          featuredImage: true,
          createdAt: true,
          category: {
            select: {
              name: true,
              slug: true,
            },
          },
          author: {
            select: {
              name: true,
              studentId: true,
            },
          },
        },
        take: limitNum,
        skip,
        orderBy: { createdAt: "desc" },
      });
    }

    // Search events if type is 'event' or 'all'
    if (!type || type === "all" || type === "event") {
      const eventWhere: any = {
        published: true,
        OR: [
          { title: { contains: searchQuery, mode: "insensitive" } },
          { description: { contains: searchQuery, mode: "insensitive" } },
          { location: { contains: searchQuery, mode: "insensitive" } },
        ],
      };

      if (category) {
        eventWhere.categoryId = category;
      }

      if (dateFrom || dateTo) {
        eventWhere.startDate = {};
        if (dateFrom) eventWhere.startDate.gte = new Date(dateFrom as string);
        if (dateTo) eventWhere.startDate.lte = new Date(dateTo as string);
      }

      results.events = await prisma.event.findMany({
        where: eventWhere,
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          coverImage: true,
          location: true,
          startDate: true,
          endDate: true,
          eventType: true,
          status: true,
          _count: {
            select: {
              registrations: true,
            },
          },
        },
        take: limitNum,
        skip,
        orderBy: { startDate: "desc" },
      });
    }

    // Search gallery if type is 'gallery' or 'all'
    if (!type || type === "all" || type === "gallery") {
      const galleryWhere: any = {
        published: true,
        OR: [
          { title: { contains: searchQuery, mode: "insensitive" } },
          { description: { contains: searchQuery, mode: "insensitive" } },
        ],
      };

      if (dateFrom || dateTo) {
        galleryWhere.eventDate = {};
        if (dateFrom) galleryWhere.eventDate.gte = new Date(dateFrom as string);
        if (dateTo) galleryWhere.eventDate.lte = new Date(dateTo as string);
      }

      results.gallery = await prisma.gallery.findMany({
        where: galleryWhere,
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          images: true,
          eventDate: true,
        },
        take: limitNum,
        skip,
        orderBy: { eventDate: "desc" },
      });
    }

    const total =
      results.blogs.length + results.events.length + results.gallery.length;
    results.pagination.total = total;
    results.pagination.totalPages = Math.ceil(total / limitNum);

    return res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Advanced search error:", error);
    return res.status(500).json({
      success: false,
      message: "Search failed",
    });
  }
});

// Search suggestions/autocomplete
router.get("/suggestions", AuthMiddleware, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== "string" || q.trim().length < 2) {
      return res.json({
        success: true,
        data: { suggestions: [] },
      });
    }

    const searchQuery = q.trim();

    // Get popular blog titles
    const blogTitles = await prisma.blog.findMany({
      where: {
        published: true,
        title: { contains: searchQuery, mode: "insensitive" },
      },
      select: { title: true },
      take: 5,
    });

    // Get popular event titles
    const eventTitles = await prisma.event.findMany({
      where: {
        published: true,
        title: { contains: searchQuery, mode: "insensitive" },
      },
      select: { title: true },
      take: 5,
    });

    const suggestions = [
      ...blogTitles.map((b) => b.title),
      ...eventTitles.map((e) => e.title),
    ]
      .filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
      .slice(0, 8);

    return res.json({
      success: true,
      data: { suggestions },
    });
  } catch (error) {
    console.error("Search suggestions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get suggestions",
    });
  }
});

export default router;
