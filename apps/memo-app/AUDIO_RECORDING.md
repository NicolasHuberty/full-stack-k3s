# Audio Recording Feature

## Overview

The Memo App now supports audio recording directly from your browser, with automatic upload to MinIO (S3-compatible storage).

## Features

✅ **Record audio** with microphone using Web Audio API
✅ **Real-time recording timer** shows duration
✅ **Preview audio** before uploading
✅ **Upload to S3 (MinIO)** with one click
✅ **Attach to memos** automatically
✅ **Supports multiple formats**: webm, wav, mp3, ogg, mp4

## How to Use

### 1. Start MinIO

Make sure Docker is running and start MinIO:

```bash
cd /Users/nicolas/memo
docker-compose up -d
```

Access MinIO Console at: `http://localhost:9001`
- Username: `minioadmin`
- Password: `minioadmin`

### 2. Create Bucket (First Time Only)

The app will automatically create the `memo` bucket, but you can also create it manually:

1. Go to `http://localhost:9001`
2. Login with credentials above
3. Click "Buckets" → "Create Bucket"
4. Name it `memo`

### 3. Record Audio

#### On New Memo Page (`/memos/new`)

1. Fill in memo title and content
2. Scroll to "Audio Recording" section
3. Click **"Start Recording"**
4. Speak into your microphone
5. Click **"Stop Recording"**
6. Preview the audio with the player
7. Click **"Upload to S3"**
8. Click **"Create Memo"** to save with attached audio

#### On Memo Edit Page (`/memos/[id]`)

1. Open an existing memo
2. Scroll to "Audio Recording" section
3. Record, preview, and upload
4. Files are automatically attached to the memo

### 4. View Attached Files

When you open an existing memo, all attached audio files will appear in the "Attached Files" section with:
- ✅ File name display
- ✅ Built-in audio player for playback
- ✅ Download link for each file
- ✅ Loading indicator while fetching files

## Technical Details

### Recording Format

- **Format**: WebM (audio/webm)
- **Browser API**: MediaRecorder API
- **Max File Size**: 50MB
- **Storage**: MinIO S3-compatible storage

### File Storage

Files are stored with this pattern:
```
uploads/{timestamp}-{filename}.webm
```

Example: `uploads/1699564800000-recording-2024-11-04T19-30-00.webm`

### Database Schema

```sql
File {
  id: uuid
  filename: string
  mimeType: string
  size: int
  s3Key: string
  createdAt: datetime
  updatedAt: datetime
}

MemoFile {
  id: uuid
  memoId: uuid
  userId: uuid
  fileId: uuid
}
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/files/upload` | POST | Upload file to MinIO |
| `/api/files/[id]/download` | GET | Download file from MinIO |
| `/api/files/[id]/url` | GET | Get presigned URL |
| `/api/memos/[id]/files` | GET | Get all files attached to a memo |
| `/api/memos/[id]/files` | POST | Attach files to memo |

## Browser Permissions

The first time you click "Start Recording", your browser will ask for microphone permission. Make sure to **Allow** it.

## Troubleshooting

### "Failed to start recording"

- Check microphone permissions in your browser
- Make sure no other app is using the microphone
- Try refreshing the page

### "Upload failed"

- Check that MinIO is running: `docker ps`
- Verify the bucket exists in MinIO console
- Check browser console for errors

### "Cannot attach files"

- Make sure the memo was created first
- Check that the file was uploaded successfully
- Verify the file ID is valid

## Architecture

```
Browser (MediaRecorder)
    ↓ (Record audio)
AudioRecorder Component
    ↓ (Blob)
/api/files/upload
    ↓ (Buffer)
FileService.uploadFile()
    ↓ (Upload)
MinIO (S3)
    ↓ (Create record)
Database (File + MemoFile)
```

## Next Steps

Future enhancements:
- [ ] Speech-to-text transcription
- [ ] Audio waveform visualization
- [ ] Trim/edit audio before upload
- [ ] Multiple audio clips per memo
- [ ] Audio playback directly from file list
- [ ] Download all attachments as ZIP
