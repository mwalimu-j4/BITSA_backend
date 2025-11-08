export interface CreateBlogData {
  title: string;
  content: string;
  excerpt?: string;
  coverImage?: string;
  published?: boolean;
  categoryId?: string;
  tags?: string[];
}

export interface UpdateBlogData {
  title?: string;
  content?: string;
  excerpt?: string;
  coverImage?: string;
  published?: boolean;
  categoryId?: string;
  tags?: string[];
}

export interface BlogFilters {
  search?: string;
  categoryId?: string;
  authorId?: string;
  published?: boolean;
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "updatedAt" | "views" | "title";
  sortOrder?: "asc" | "desc";
}
