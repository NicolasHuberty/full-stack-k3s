# Task Queue System - BullMQ

## Overview

The Memo App uses **BullMQ** (Redis-based) for asynchronous task processing. This allows file uploads and other time-consuming operations to happen in the background without blocking the API response.

## Architecture

```
API Request → Queue Job → Redis → Worker Process → Complete
```

### Components

1. **Redis** - Message broker and job storage
2. **BullMQ Queues** - Job queues (file-upload, file-process, file-delete)
3. **Workers** - Background processes that execute jobs
4. **API Endpoints** - Queue job creation and monitoring

## Setup

### 1. Start Redis

Redis is included in docker-compose:

```bash
cd /Users/nicolas/memo
docker-compose up -d redis
```

Verify Redis is running:
```bash
docker ps | grep redis
# or
redis-cli ping  # Should return PONG
```

### 2. Start Workers

Workers process jobs from the queue. Start them in a separate terminal:

```bash
cd memo-app
bun worker

# Or with auto-reload during development:
bun worker:dev
```

You should see:
```
[Worker] File upload worker started, processing queue: file-upload
[Worker] File process worker started, processing queue: file-process
[Workers] All workers started successfully
```

## Queues

### 1. File Upload Queue

**Purpose:** Upload files to MinIO asynchronously

**Job Data:**
```typescript
{
  fileBuffer: string;  // base64 encoded
  filename: string;
  mimeType: string;
  size: number;
  memoId?: string;     // Optional: attach to memo
}
```

**Usage:**
```bash
POST /api/files/upload-async
Content-Type: multipart/form-data

{
  file: <File>,
  memoId: "uuid-here"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "1",
  "message": "File upload queued successfully"
}
```

### 2. File Process Queue

**Purpose:** Process files (transcribe, analyze, compress)

**Job Data:**
```typescript
{
  fileId: string;
  s3Key: string;
  mimeType: string;
  operation: "transcribe" | "analyze" | "compress";
}
```

**Features (TODO):**
- Audio transcription (Whisper API)
- File analysis (duration, quality)
- File compression/optimization

### 3. File Delete Queue

**Purpose:** Cleanup and delete files from MinIO

**Job Data:**
```typescript
{
  fileId: string;
  s3Key: string;
}
```

## Monitoring

### Queue Dashboard

Access the monitoring dashboard at: `http://localhost:3000/queue`

**Features:**
- Redis connection status
- Job counts per queue (waiting, active, completed, failed)
- Real-time updates (every 5 seconds)
- How-to guides

### API Endpoints

#### Check Job Status
```bash
GET /api/queue/job/{jobId}
```

Response:
```json
{
  "jobId": "1",
  "state": "completed",
  "progress": 100,
  "result": {
    "success": true,
    "fileId": "uuid",
    "filename": "recording.webm",
    "url": "/api/files/uuid/download"
  }
}
```

#### Queue Health Check
```bash
GET /api/queue/health
```

Response:
```json
{
  "redis": "connected",
  "queues": {
    "fileUpload": {
      "waiting": 0,
      "active": 1,
      "completed": 15,
      "failed": 0
    },
    "fileProcess": {...},
    "fileDelete": {...}
  }
}
```

## Configuration

### Queue Settings

Located in `src/lib/queue.ts`:

```typescript
defaultJobOptions: {
  attempts: 3,              // Retry 3 times on failure
  backoff: {
    type: "exponential",    // Exponential backoff
    delay: 2000,           // Start with 2s delay
  },
  removeOnComplete: 100,   // Keep last 100 completed jobs
  removeOnFail: 500,       // Keep last 500 failed jobs
}
```

### Worker Settings

```typescript
{
  concurrency: 5,          // Process 5 jobs simultaneously
  limiter: {
    max: 10,              // Max 10 jobs
    duration: 1000,       // per second (rate limiting)
  },
}
```

## Usage Examples

### Async File Upload

```typescript
// Client-side
const formData = new FormData();
formData.append("file", audioBlob, "recording.webm");
formData.append("memoId", memoId);

const response = await fetch("/api/files/upload-async", {
  method: "POST",
  body: formData,
});

const { jobId } = await response.json();

// Poll for completion
const checkStatus = async () => {
  const res = await fetch(`/api/queue/job/${jobId}`);
  const job = await res.json();

  if (job.state === "completed") {
    console.log("Upload complete!", job.result);
  } else if (job.state === "failed") {
    console.error("Upload failed!");
  } else {
    // Still processing, check again
    setTimeout(checkStatus, 1000);
  }
};

checkStatus();
```

### Add Job Programmatically

```typescript
import { addFileUploadJob } from "@/lib/queue";

const job = await addFileUploadJob({
  fileBuffer: buffer.toString("base64"),
  filename: "test.webm",
  mimeType: "audio/webm",
  size: 1024,
  memoId: "memo-uuid",
});

console.log("Job queued:", job.id);
```

## Benefits

### Why Use a Queue?

1. **Non-blocking API** - Return response immediately
2. **Reliability** - Automatic retries on failure
3. **Scalability** - Process multiple files in parallel
4. **Monitoring** - Track job status and progress
5. **Rate limiting** - Prevent overload
6. **Persistence** - Jobs survive server restarts

### Synchronous vs Asynchronous

**Synchronous Upload** (`/api/files/upload`):
- ✅ Simple
- ✅ Immediate result
- ❌ Blocks API response
- ❌ No retry on failure
- ❌ Times out on large files

**Asynchronous Upload** (`/api/files/upload-async`):
- ✅ Instant API response
- ✅ Automatic retries
- ✅ Progress tracking
- ✅ Scalable
- ❌ Requires polling or webhooks

## Troubleshooting

### Redis Connection Failed

```bash
# Check if Redis is running
docker ps | grep redis

# Start Redis
docker-compose up -d redis

# Check logs
docker logs memo-redis
```

### Workers Not Processing Jobs

```bash
# Check if workers are running
ps aux | grep "workers/index.ts"

# Start workers
bun worker

# Check worker logs for errors
```

### Jobs Stuck in "Waiting"

- Workers not running
- Redis connection lost
- Worker crashed (check logs)

### High Failed Job Count

- Check worker logs for error messages
- Verify MinIO is accessible
- Check database connection
- Review job data for invalid inputs

## Production Deployment

### Multiple Workers

Run multiple worker processes for better performance:

```bash
# Terminal 1
bun worker

# Terminal 2
bun worker

# Terminal 3
bun worker
```

Or use PM2:
```bash
pm2 start src/workers/index.ts --name memo-worker -i 3
```

### Monitoring

Consider adding:
- **Bull Board** - Web UI for queue management
- **Prometheus** - Metrics export
- **Alerting** - Notify on high failure rates

## Future Enhancements

- [ ] Add Bull Board web UI
- [ ] Implement audio transcription (Whisper)
- [ ] Add webhook notifications on job completion
- [ ] Export queue metrics to Prometheus
- [ ] Add scheduled jobs (cron)
- [ ] Implement job priorities
- [ ] Add dead letter queue for failed jobs
- [ ] Rate limiting per user
