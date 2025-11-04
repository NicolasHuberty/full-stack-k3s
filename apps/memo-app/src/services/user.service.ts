import type { CreateUserInput, LoginInput, UpdateUserInput } from "@/dto";
import { prisma } from "@/lib/prisma";
import type { SafeUser, User, UserWithStats } from "@/types";

export class UserService {
  /**
   * Create a new user
   * Note: In production, hash the password with bcrypt!
   */
  async createUser(data: CreateUserInput): Promise<SafeUser> {
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new Error("User with this email already exists");
    }

    // TODO: Hash password with bcrypt in production
    // const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: data.password, // In production: use hashedPassword
      },
    });

    return this.toSafeUser(user);
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<SafeUser | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) return null;

    return this.toSafeUser(user);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Update user
   */
  async updateUser(id: string, data: UpdateUserInput): Promise<SafeUser> {
    // If updating password, hash it
    // if (data.password) {
    //   data.password = await bcrypt.hash(data.password, 10);
    // }

    const user = await prisma.user.update({
      where: { id },
      data,
    });

    return this.toSafeUser(user);
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<void> {
    // Delete associated data first
    await prisma.memoFile.deleteMany({
      where: { userId: id },
    });

    await prisma.memo.deleteMany({
      where: { userId: id },
    });

    await prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Login / authenticate user
   * Note: In production, use bcrypt.compare!
   */
  async login(data: LoginInput): Promise<SafeUser> {
    const user = await this.getUserByEmail(data.email);

    if (!user) {
      throw new Error("Invalid credentials");
    }

    // TODO: In production, use bcrypt.compare
    // const isValid = await bcrypt.compare(data.password, user.password);
    const isValid = data.password === user.password;

    if (!isValid) {
      throw new Error("Invalid credentials");
    }

    return this.toSafeUser(user);
  }

  /**
   * Get user with statistics
   */
  async getUserWithStats(id: string): Promise<UserWithStats | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            memos: true,
            memoFiles: true,
          },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      memoCount: user._count.memos,
      fileCount: user._count.memoFiles,
    };
  }

  /**
   * Remove sensitive data from user object
   */
  private toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }
}

export const userService = new UserService();
