# Clean Architecture - Memo App

## Folder Structure

```
src/
├── app/
│   ├── api/                     # API Routes (HTTP layer)
│   │   ├── memos/
│   │   │   ├── route.ts        # GET, POST /api/memos
│   │   │   └── [id]/
│   │   │       ├── route.ts    # GET, PATCH, DELETE /api/memos/[id]
│   │   │       ├── status/
│   │   │       │   └── route.ts # PATCH /api/memos/[id]/status
│   │   │       └── files/
│   │   │           └── route.ts # POST /api/memos/[id]/files
│   │   ├── users/
│   │   │   ├── route.ts        # POST /api/users
│   │   │   └── [id]/
│   │   │       └── route.ts    # GET, PATCH, DELETE /api/users/[id]
│   │   └── auth/
│   │       └── login/
│   │           └── route.ts    # POST /api/auth/login
│   └── ...pages                # Your Next.js pages
├── components/                  # React components
├── dto/                        # Data Transfer Objects (Zod schemas)
│   ├── memo.dto.ts
│   ├── user.dto.ts
│   ├── file.dto.ts
│   └── index.ts
├── lib/
│   ├── prisma.ts              # Prisma client singleton
│   └── utils.ts
├── services/                   # Business logic layer
│   ├── memo.service.ts
│   ├── user.service.ts
│   ├── file.service.ts
│   └── index.ts
└── types/                      # TypeScript domain types
    ├── memo.ts
    ├── user.ts
    ├── file.ts
    └── index.ts
```

## Architecture Layers

### 1. Types (`src/types/`)
Domain models and TypeScript interfaces. These represent your business entities.

**Purpose:**
- Define the shape of your domain objects
- Type safety across the application
- Independent of database schema

### 2. DTOs (`src/dto/`)
Zod validation schemas for input/output.

**Purpose:**
- Validate API request data
- Type-safe input parsing
- Define API contracts
- Automatic TypeScript type inference

**Example:**
```typescript
import { createMemoSchema } from "@/dto";

const data = createMemoSchema.parse(body); // Throws if invalid
```

### 3. Services (`src/services/`)
Business logic layer. This is where your application logic lives.

**Purpose:**
- Implement business rules
- Orchestrate database operations
- Complex validations
- Reusable across different API routes

**Example:**
```typescript
// Business rule: Cannot delete running memos
async deleteMemo(id: string): Promise<void> {
  const memo = await this.getMemoById(id);
  if (memo.status === MemoStatus.RUNNING) {
    throw new Error("Cannot delete a running memo");
  }
  await this.updateMemo(id, { status: MemoStatus.ARCHIVED });
}
```

### 4. API Routes (`src/app/api/`)
Thin HTTP layer. Just handles requests/responses.

**Purpose:**
- Parse request params/body
- Call service methods
- Return appropriate HTTP status codes
- Handle errors

**Example:**
```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = createMemoSchema.parse(body); // DTO validation
  const memo = await memoService.createMemo(data); // Service call
  return NextResponse.json({ data: memo }, { status: 201 });
}
```

## API Endpoints

### Memos

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/memos` | Get all memos (with filters) |
| POST | `/api/memos` | Create new memo |
| GET | `/api/memos/[id]` | Get memo by ID |
| PATCH | `/api/memos/[id]` | Update memo |
| DELETE | `/api/memos/[id]` | Delete memo (soft) |
| PATCH | `/api/memos/[id]/status` | Update memo status |
| POST | `/api/memos/[id]/files` | Attach files to memo |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users` | Create new user |
| GET | `/api/users/[id]` | Get user by ID |
| PATCH | `/api/users/[id]` | Update user |
| DELETE | `/api/users/[id]` | Delete user |

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login user |

## Example Usage

### Create a Memo

```bash
curl -X POST http://localhost:3000/api/memos \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Memo",
    "content": "This is the content",
    "userId": "user-uuid-here"
  }'
```

### Get Memos with Filters

```bash
curl "http://localhost:3000/api/memos?userId=user-uuid&status=DRAFT&limit=10"
```

### Update Memo Status

```bash
curl -X PATCH http://localhost:3000/api/memos/[memo-id]/status \
  -H "Content-Type: application/json" \
  -d '{"status": "RUNNING"}'
```

### Attach Files to Memo

```bash
curl -X POST http://localhost:3000/api/memos/[memo-id]/files \
  -H "Content-Type: application/json" \
  -d '{
    "fileIds": ["file-uuid-1", "file-uuid-2"]
  }'
```

## Business Rules (Examples)

The service layer enforces these rules:

1. **Memo Status Transitions:**
   - ❌ Cannot change RUNNING → DRAFT
   - ❌ Cannot modify ARCHIVED memos

2. **Memo Deletion:**
   - ❌ Cannot delete RUNNING memos
   - ✅ Deletion = soft delete (ARCHIVED status)

3. **File Attachments:**
   - ✅ Validates all files exist before attaching
   - ✅ Max file size: 10MB
   - ✅ Allowed types: images, PDF, text, JSON

4. **User Management:**
   - ✅ Email must be unique
   - ✅ Password min 8 characters
   - ⚠️ TODO: Hash passwords with bcrypt

## How to Extend

### Adding a New Feature

1. **Define types** in `src/types/`
2. **Create DTOs** in `src/dto/` with Zod schemas
3. **Implement service** in `src/services/` with business logic
4. **Create API routes** in `src/app/api/` that call services

### Example: Add Comments Feature

```typescript
// 1. Type
export interface Comment {
  id: string;
  memoId: string;
  userId: string;
  content: string;
  createdAt: Date;
}

// 2. DTO
export const createCommentSchema = z.object({
  memoId: z.string().uuid(),
  userId: z.string().uuid(),
  content: z.string().min(1).max(500),
});

// 3. Service
export class CommentService {
  async createComment(data: CreateCommentInput) {
    // Business logic here
  }
}

// 4. API Route
export async function POST(request: NextRequest) {
  const data = createCommentSchema.parse(await request.json());
  const comment = await commentService.createComment(data);
  return NextResponse.json({ data: comment }, { status: 201 });
}
```

## TODO

- [ ] Implement bcrypt password hashing
- [ ] Add JWT authentication/sessions
- [ ] Implement MinIO file upload/download
- [ ] Add API error handler middleware
- [ ] Add request rate limiting
- [ ] Add logging (Pino)
- [ ] Add tests (Vitest)
- [ ] Add API documentation (OpenAPI/Swagger)
