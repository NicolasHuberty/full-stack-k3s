# Memo Workflow Guide

## Overview

This guide explains how the automated memo workflow works, from recording audio to generating transcription documents.

## Complete Workflow

### Step 1: Create Memo
1. Go to `/memos/new`
2. Enter title and content
3. Record audio (optional)
4. Click "Create Memo"
5. Status: **DRAFT**

### Step 2: Record Audio (if not done)
1. Open the memo
2. Use Audio Recorder component
3. Click "Start Recording"
4. Speak your memo
5. Click "Stop Recording"
6. Listen to preview
7. Click "Upload to S3"
8. File is attached to memo automatically

### Step 3: Trigger Processing
**Option A: Automatic (Recommended)**
1. Change memo status to **RUNNING**
2. Click "Save Changes"
3. ✨ Transcription starts automatically!

**Option B: Manual**
1. Click "Transcribe All" button in Attached Files section
2. Confirm

### Step 4: Monitor Progress
1. Go to `/queue` (Queue Dashboard)
2. Watch the "File Process Queue"
3. See jobs move from "Waiting" → "Active" → "Completed"

### Step 5: Get Results
Once transcription completes:
- 3 new files created per audio file:
  - `transcription-{id}.txt`
  - `transcription-{id}.pdf`
  - `transcription-{id}.docx`
- All stored in MinIO
- Accessible via download links
- Contain full transcription + timestamps

### Step 6: Mark Complete
1. Review transcription documents
2. Change status to **DONE**
3. Memo workflow complete!

## Status Meanings

| Status | Meaning | Auto Actions |
|--------|---------|--------------|
| **DRAFT** | Initial state | None |
| **PREPARING** | Getting ready | None |
| **RUNNING** | Active processing | 🚀 **Auto-transcribe all audio files** |
| **DONE** | Completed | None |
| **CANCELLED** | Stopped | None |
| **FAILED** | Error occurred | None |
| **ARCHIVED** | Hidden/deleted | None |

## Automatic Triggers

### When Status = RUNNING

The system automatically:
1. ✅ Finds all audio files attached to memo
2. ✅ Queues transcription job for each file
3. ✅ Downloads audio from MinIO
4. ✅ Sends to Mistral AI Voxtral
5. ✅ Receives transcription with timestamps
6. ✅ Generates TXT, PDF, DOCX documents
7. ✅ Uploads all documents to MinIO
8. ✅ Creates database records
9. ✅ Jobs marked as complete

**You don't need to do anything else!**

## Checking Status

### Via UI (Queue Dashboard)
```
/queue
```

### Via API
```bash
# Get job status
GET /api/queue/job/{jobId}

# Get queue health
GET /api/queue/health
```

## Example Timeline

```
00:00 - Create memo (DRAFT)
00:30 - Record 1 minute audio
01:00 - Upload to S3
01:05 - Change status to RUNNING
01:06 - Transcription job queued (automatic)
01:10 - Worker picks up job
01:15 - Audio downloaded from MinIO
01:20 - Mistral API transcribing...
01:35 - Transcription complete
01:36 - Generating TXT document...
01:37 - Generating PDF document...
01:38 - Generating DOCX document...
01:39 - Uploading TXT to MinIO...
01:40 - Uploading PDF to MinIO...
01:41 - Uploading DOCX to MinIO...
01:42 - Job complete! ✅
```

## Troubleshooting

### No Transcription Happening

**Check:**
1. Is memo status set to RUNNING?
2. Are audio files attached?
3. Are workers running? (`bun worker`)
4. Is Redis running? (`docker ps | grep redis`)
5. Check worker logs for errors

**Common Issues:**
- Workers not started → Run `bun worker`
- Redis not running → Run `docker-compose up -d redis`
- No audio files → Attach audio files first
- Invalid audio format → Check file type (must be audio/*)

### Transcription Failed

**Check Queue Dashboard:**
1. Go to `/queue`
2. Look at "Failed" count
3. Check worker logs in terminal

**Common Causes:**
- Invalid Mistral API key
- Audio file corrupted
- Network timeout
- File too large (>50MB)

### Documents Not Generated

**Check:**
1. Did transcription job complete?
2. Check worker logs for document generation errors
3. Verify MinIO is accessible
4. Check disk space

## Manual Operations

### Transcribe Without Changing Status

If you don't want to change status to RUNNING:

```bash
# Via API
POST /api/memos/{memoId}/transcribe

# Via UI
Click "Transcribe All" button
```

### Transcribe Single File

```bash
POST /api/files/{fileId}/transcribe
```

### Check Specific Job

```bash
GET /api/queue/job/{jobId}
```

## Best Practices

### 1. Record Quality Audio
- Use good microphone
- Quiet environment
- Clear speech
- Avoid background noise

### 2. Reasonable File Sizes
- Aim for < 10MB per file
- Max 50MB supported
- Longer audio = longer processing

### 3. Monitor Progress
- Check Queue Dashboard regularly
- Look for failed jobs
- Review worker logs

### 4. Keep Workers Running
- Use PM2 for production: `pm2 start src/workers/index.ts`
- Or systemd service
- Monitor memory usage

### 5. Regular Cleanup
- Archive old memos
- Delete unused files
- Clear completed jobs from Redis

## Production Tips

### Scale Workers
```bash
# Run multiple workers
pm2 start src/workers/index.ts --name memo-worker -i 3
```

### Monitor Queue
- Add alerting for high failure rates
- Monitor queue sizes
- Track processing times

### Backup Strategy
- Regular MinIO backups
- Database backups
- Keep raw audio files

### Cost Optimization
- Batch transcription during off-hours
- Cache frequent transcriptions
- Monitor Mistral API usage

## Advanced Workflows

### Bulk Processing
1. Create multiple memos with audio
2. Set all to RUNNING at once
3. Workers process in parallel
4. Check Queue Dashboard

### Scheduled Processing
```typescript
// TODO: Add cron job support
// Process all PREPARING memos at 2 AM
```

### Custom Post-Processing
```typescript
// TODO: Add webhooks
// Notify on completion
// Send email with documents
// Update external systems
```

## API Reference

### Memo Status Update
```bash
PATCH /api/memos/{id}
{
  "status": "RUNNING"
}
```

### Trigger Transcription
```bash
POST /api/memos/{id}/transcribe
```

### Check Job Status
```bash
GET /api/queue/job/{jobId}
```

### Queue Health
```bash
GET /api/queue/health
```

## Summary

**Simple 3-Step Process:**
1. ✅ Record & upload audio
2. ✅ Set status to RUNNING
3. ✅ Done! Documents generated automatically

**Monitor progress:** `/queue`
**Download documents:** Attached Files section
**Questions?** Check worker logs and Queue Dashboard
