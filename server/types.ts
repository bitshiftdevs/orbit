export interface Env {
  DB: D1Database;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  ASSETS: Fetcher;
}

export interface JWTPayload {
  userId: string;
  iat: number;
  exp: number;
}

export interface AuthUser {
  id: string;
  email: string;
  studentId: string;
  school: string;
  role: string;
  verified: boolean;
  createdAt: Date;
}

export interface CreateUserData {
  email: string;
  fullname: string;
  password: string;
  studentId: string;
  ghanaCardId: string;
  school: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface CreateOrderData {
  items: any[];
  paymentMethod: string;
  school: string;
  pickupLocation?: string;
}

export interface UpdateOrderData {
  status?: string;
  paymentStatus?: string;
  trackingNumber?: string;
}

export interface CreateProductData {
  name: string;
  description: string;
  price: number;
  schoolId: string;
  imageUrl?: string;
}

export interface UpdateProductData {
  name?: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  inStock?: boolean;
}

export interface CreatePromoData {
  code: string;
  discount: number;
  validFrom: string;
  validUntil: string;
}

export interface ValidatePromoData {
  code: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  stack: string; // JSON or comma-separated string
  images: string; // JSON or comma-separated string
  createdAt: string;
  updatedAt: string;
}

export interface Bug {
  id: string;
  projectId: string;
  description: string;
  status: string;
  createdAt: string;
}

export interface Todo {
  id: string;
  projectId: string;
  description: string;
  status: string;
  createdAt: string;
}

export interface Secret {
  id: string;
  projectId: string;
  key: string;
  value: string;
}

export interface EnvVar {
  id: string;
  projectId: string;
  key: string;
  value: string;
}
