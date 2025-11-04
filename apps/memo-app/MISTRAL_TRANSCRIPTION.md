## Mistral AI Audio Transcription

## Overview

The Memo App now includes automatic audio transcription powered by **Mistral AI's Voxtral** models. When you upload audio, it can be transcribed and converted into documents (TXT, PDF, DOCX) that are automatically stored in MinIO.

## Features

✅ **Automatic transcription** using Voxtral Mini
✅ **Multiple document formats** (TXT, PDF, DOCX)
✅ **Timestamped segments** for precise navigation
✅ **Language detection** (or manual specification)
✅ **Asynchronous processing** via queue system
✅ **All documents stored in MinIO** for easy access

## How It Works

### Architecture

```
Audio Upload → MinIO Storage → Transcription Queue → Worker
    ↓
Mistral Voxtral API
    ↓
Transcription Result
    ↓
Generate Documents (TXT/PDF/DOCX)
    ↓
Upload to MinIO → Create Database Records
```

## Usage

### 1. Transcribe Single File

**Via API:**
```bash
POST /api/files/{fileId}/transcribe
```

This queues a transcription job for a specific audio file.

**Via UI:**
Currently manual via API. UI button coming soon.

### 2. Transcribe All Memo Files

**Via API:**
```bash
POST /api/memos/{memoId}/transcribe
```

**Via UI:**
1. Open a memo with audio files attached
2. Click "Transcribe All" button in the Attached Files section
3. Confirm the action
4. Check Queue Dashboard for progress

### 3. Monitor Progress

Visit the Queue Dashboard: `http://localhost:3000/queue`

Check specific job status:
```bash
GET /api/queue/job/{jobId}
```

## Configuration

### API Key

Set in `.env`:
```bash
MISTRAL_API_KEY="ji6syvAYe552OkI1fI6hsbHOJrpKb6PD"
```

### Model

Currently using: `voxtral-mini-latest`

This model provides:
- Fast transcription
- Good accuracy
- Timestamp support
- Language detection

## Generated Documents

For each audio file transcribed, **3 documents** are created:

### 1. Plain Text (.txt)
- Simple formatted text
- Easy to read and edit
- Smallest file size

### 2. PDF (.pdf)
- Professional formatting
- Title and metadata
- Timestamped segments on separate page
- Ready for sharing/printing

### 3. Word Document (.docx)
- Editable format
- Structured with headings
- Metadata table
- Timestamped segments
- Compatible with Microsoft Word, Google Docs, etc.

## Document Content

Each generated document includes:

- **Title:** Transcription date
- **Metadata:**
  - Memo title (if available)
  - Date created
  - Language detected
  - Audio duration
- **Full Transcription:** Complete text
- **Timestamped Segments:** (if enabled)
  - Start and end time for each segment
  - Corresponding text

## Examples

### Example: Transcribe Memo Audio

```bash
# 1. Upload audio to memo
POST /api/files/upload
{
  file: <audio file>,
  memoId: "memo-123"
}

# 2. Transcribe all audio files in memo
POST /api/memos/memo-123/transcribe

# Response:
{
  "success": true,
  "message": "Queued 1 transcription job(s)",
  "jobs": [
    {
      "fileId": "file-456",
      "jobId": "789",
      "filename": "recording.webm"
    }
  ]
}

# 3. Check job status
GET /api/queue/job/789

# Response:
{
  "jobId": "789",
  "state": "completed",
  "progress": 100,
  "result": {
    "success": true,
    "transcription": "Hello, this is a test recording...",
    "language": "en",
    "duration": 45.2,
    "segmentCount": 12,
    "documents": [
      { "format": "txt", "fileId": "doc-1" },
      { "format": "pdf", "fileId": "doc-2" },
      { "format": "docx", "fileId": "doc-3" }
    ]
  }
}
```

### Example: Access Generated Documents

```bash
# Download TXT
GET /api/files/doc-1/download

# Download PDF
GET /api/files/doc-2/download

# Download DOCX
GET /api/files/doc-3/download
```

## Supported Audio Formats

- audio/webm (browser recordings)
- audio/wav
- audio/mp3
- audio/mpeg
- audio/ogg
- audio/m4a

## Processing Time

Typical processing times (approximate):

| Duration | Transcription | Doc Generation | Total |
|----------|--------------|----------------|-------|
| 30s audio | ~5s | ~2s | ~7s |
| 1min audio | ~8s | ~2s | ~10s |
| 5min audio | ~30s | ~3s | ~33s |

*Times may vary based on audio quality and API load*

## Troubleshooting

### Transcription Failed

**Error:** "Transcription failed"

**Solutions:**
- Check Mistral API key is valid
- Verify audio file is not corrupted
- Check audio format is supported
- Review worker logs for details

### No Documents Generated

**Error:** "Documents not found"

**Solutions:**
- Check if transcription job completed successfully
- Verify MinIO is accessible
- Check worker logs for errors
- Ensure enough disk space

### Worker Not Processing

**Issue:** Jobs stuck in "waiting" state

**Solutions:**
```bash
# Check if workers are running
bun worker

# Check Redis connection
docker ps | grep redis

# View worker logs
# Look for errors in terminal where worker is running
```

## API Reference

### Transcribe Single File

```bash
POST /api/files/{fileId}/transcribe
```

**Response:**
```json
{
  "success": true,
  "jobId": "123",
  "message": "Transcription job queued successfully"
}
```

### Transcribe Memo Files

```bash
POST /api/memos/{memoId}/transcribe
```

**Response:**
```json
{
  "success": true,
  "message": "Queued 2 transcription job(s)",
  "jobs": [
    {
      "fileId": "file-1",
      "jobId": "job-1",
      "filename": "recording1.webm"
    },
    {
      "fileId": "file-2",
      "jobId": "job-2",
      "filename": "recording2.webm"
    }
  ]
}
```

### Check Job Status

```bash
GET /api/queue/job/{jobId}
```

**Response:**
```json
{
  "jobId": "123",
  "name": "process-transcribe",
  "state": "completed",
  "progress": 100,
  "result": {
    "success": true,
    "transcription": "Full text...",
    "language": "en",
    "duration": 45.2,
    "segmentCount": 12,
    "documents": [
      { "format": "txt", "fileId": "..." },
      { "format": "pdf", "fileId": "..." },
      { "format": "docx", "fileId": "..." }
    ]
  }
}
```

## Costs

Mistral AI Voxtral pricing (as of 2024):
- Voxtral Mini: ~$0.003 per minute of audio
- Check current pricing: https://mistral.ai/pricing

## Future Enhancements

- [ ] UI button to transcribe individual files
- [ ] Real-time progress indicator
- [ ] Webhook notifications on completion
- [ ] Speaker diarization (identify different speakers)
- [ ] Custom document templates
- [ ] Batch transcription optimization
- [ ] Caching for frequently transcribed audio
- [ ] Export transcriptions to external services

## Privacy & Security

- Audio files stored securely in MinIO
- API key stored in environment variables
- Transcriptions processed via secure HTTPS
- Generated documents private to memo owner
- No data retained by Mistral AI after processing

## Learn More

- Mistral AI Docs: https://docs.mistral.ai/capabilities/audio/
- Voxtral Models: https://docs.mistral.ai/capabilities/audio/#voxtral-models
- API Reference: https://docs.mistral.ai/api/
