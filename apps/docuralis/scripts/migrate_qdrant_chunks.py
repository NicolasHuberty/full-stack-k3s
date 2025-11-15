#!/usr/bin/env python3
"""
Migration script to sync Qdrant vectors with PostgreSQL DocumentChunks

Memory-efficient multi-threaded approach:
1. Producer thread fetches batches from Qdrant and adds to queue
2. Worker threads (20) pull from queue and process
3. Only ~20 batches in memory at once (not all 2.5M vectors)
4. Automatic retries and progress tracking

Old Qdrant format: {filename, chunk_index, page_number, combined}
New Qdrant format: {documentId, collectionId, chunkIndex, content, documentName}
"""

import psycopg2
from psycopg2.extras import execute_batch
import requests
from typing import Dict, List, Any, Optional
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
import threading
from queue import Queue

# Configuration
POSTGRES_CONFIG = {
    'host': 'postgres.docuralis.com',
    'port': 30543,
    'database': 'rag_database',
    'user': 'rag_admin',
    'password': 'changeme123'
}

QDRANT_URL = 'https://qdrant.docuralis.com'
COLLECTION_ID = 'cmhxblm5p00018001iwvrwdxq'
VECTOR_BATCH_SIZE = 5000  # Fetch 5000 vectors at a time
NUM_THREADS = 20  # Parallel worker threads
QUEUE_SIZE = 30  # Max batches in memory (30 batches = ~150k vectors max)
MAX_RETRIES = 3  # Retry failed operations
DRY_RUN = False  # LIVE MODE - will modify data


class MigrationStats:
    def __init__(self):
        self.vectors_processed = 0
        self.documents_processed = 0
        self.chunks_created = 0
        self.skipped_no_doc = 0
        self.errors = 0
        self.start_time = time.time()
        self.total_vectors = 0
        self.batches_fetched = 0
        self.batches_processed = 0
        self.lock = threading.Lock()

    def add_batch_fetched(self):
        with self.lock:
            self.batches_fetched += 1

    def add_batch_processed(self):
        with self.lock:
            self.batches_processed += 1

    def add_vectors(self, count: int):
        with self.lock:
            self.vectors_processed += count

    def add_chunks(self, count: int):
        with self.lock:
            self.chunks_created += count

    def add_documents(self, count: int):
        with self.lock:
            self.documents_processed += count

    def add_skipped(self, count: int):
        with self.lock:
            self.skipped_no_doc += count

    def add_error(self):
        with self.lock:
            self.errors += 1

    def print_progress(self):
        with self.lock:
            elapsed = time.time() - self.start_time
            percentage = (self.vectors_processed / self.total_vectors * 100) if self.total_vectors > 0 else 0

            print(f"\n{'='*80}")
            print(f"Progress: {self.vectors_processed:,} / {self.total_vectors:,} vectors ({percentage:.1f}%)")
            print(f"Batches: {self.batches_processed} processed | {self.batches_fetched} fetched")
            print(f"Documents: {self.documents_processed:,} | Chunks: {self.chunks_created:,}")
            print(f"Skipped: {self.skipped_no_doc:,} | Errors: {self.errors}")
            print(f"Elapsed: {elapsed:.1f}s | Rate: {self.vectors_processed/elapsed:.0f} vectors/sec")

            if self.vectors_processed > 0 and self.total_vectors > 0:
                remaining = self.total_vectors - self.vectors_processed
                rate = self.vectors_processed / elapsed
                eta_seconds = remaining / rate if rate > 0 else 0
                eta_minutes = eta_seconds / 60
                print(f"ETA: {eta_minutes:.1f} minutes")
            print(f"{'='*80}")


def get_pg_connection():
    """Get a new PostgreSQL connection (one per thread)"""
    return psycopg2.connect(**POSTGRES_CONFIG)


def qdrant_scroll(limit: int = 100, offset: Optional[str] = None, retries: int = MAX_RETRIES) -> tuple:
    """Scroll through Qdrant vectors without filter"""
    url = f"{QDRANT_URL}/collections/{COLLECTION_ID}/points/scroll"

    payload = {
        "limit": limit,
        "with_payload": True,
        "with_vector": False
    }

    if offset:
        payload["offset"] = offset

    for attempt in range(retries):
        try:
            response = requests.post(url, json=payload, timeout=30)
            response.raise_for_status()

            data = response.json()
            points = data.get('result', {}).get('points', [])
            next_offset = data.get('result', {}).get('next_page_offset')

            return points, next_offset
        except Exception as e:
            if attempt == retries - 1:
                raise
            time.sleep(1 * (attempt + 1))  # Exponential backoff

    return [], None


def get_documents_by_filenames(pg_conn, filenames: List[str], collection_id: str) -> Dict[str, Dict]:
    """Get multiple documents from PostgreSQL by originalName (batched)"""
    if not filenames:
        return {}

    with pg_conn.cursor() as cur:
        cur.execute(
            '''SELECT id, "originalName", "collectionId"
               FROM "Document"
               WHERE "originalName" = ANY(%s) AND "collectionId" = %s''',
            (filenames, collection_id)
        )

        docs_by_filename = {}
        for row in cur.fetchall():
            docs_by_filename[row[1]] = {
                'id': row[0],
                'originalName': row[1],
                'collectionId': row[2]
            }
        return docs_by_filename


def create_chunk_id() -> str:
    """Generate a unique chunk ID"""
    return f"chunk_{uuid.uuid4().hex[:24]}"


def producer_thread(work_queue: Queue, stats: MigrationStats, stop_event: threading.Event):
    """Producer: Fetches batches from Qdrant and adds to queue"""
    offset = None
    batch_num = 0

    try:
        while not stop_event.is_set():
            batch_num += 1

            # Fetch batch from Qdrant
            points, next_offset = qdrant_scroll(limit=VECTOR_BATCH_SIZE, offset=offset)

            if not points:
                break

            # Add to work queue (blocks if queue is full)
            work_queue.put((batch_num, points))
            stats.add_batch_fetched()

            if next_offset is None:
                break

            offset = next_offset

    except Exception as e:
        print(f"  ❌ Producer error: {e}")
        stats.add_error()
    finally:
        # Signal workers that no more batches are coming
        for _ in range(NUM_THREADS):
            work_queue.put(None)


def worker_thread(work_queue: Queue, stats: MigrationStats, stop_event: threading.Event):
    """Worker: Processes batches from queue"""
    pg_conn = None

    try:
        pg_conn = get_pg_connection()

        while not stop_event.is_set():
            # Get batch from queue
            item = work_queue.get()

            if item is None:  # Poison pill - shutdown signal
                work_queue.task_done()
                break

            batch_num, vectors = item

            try:
                # Group vectors by filename
                vectors_by_filename = {}
                for vector in vectors:
                    filename = vector['payload'].get('filename')
                    if not filename:
                        continue

                    if filename not in vectors_by_filename:
                        vectors_by_filename[filename] = []
                    vectors_by_filename[filename].append(vector)

                # Batch lookup all documents at once
                filenames = list(vectors_by_filename.keys())
                docs_by_filename = get_documents_by_filenames(pg_conn, filenames, COLLECTION_ID)

                # Process each filename group
                for filename, file_vectors in vectors_by_filename.items():
                    doc = docs_by_filename.get(filename)

                    if not doc:
                        stats.add_skipped(len(file_vectors))
                        stats.add_vectors(len(file_vectors))
                        continue

                    doc_id = doc['id']
                    collection_id = doc['collectionId']

                    # Prepare chunks
                    chunks_to_create = []

                    for vector in file_vectors:
                        payload = vector['payload']
                        vector_id = vector['id']

                        chunk_index = payload.get('chunk_index', 0)
                        content = payload.get('combined', '')
                        page_number = payload.get('page_number')

                        chunk_id = create_chunk_id()
                        chunk = (
                            chunk_id,
                            doc_id,
                            chunk_index,
                            content,
                            page_number,
                            page_number,
                            vector_id,
                            int(len(content.split()) * 1.3)
                        )
                        chunks_to_create.append(chunk)

                    if not DRY_RUN and chunks_to_create:
                        with pg_conn.cursor() as cur:
                            try:
                                execute_batch(cur,
                                    '''INSERT INTO "DocumentChunk"
                                       (id, "documentId", "chunkIndex", content, "startPage", "endPage", "vectorId", "tokenCount", "createdAt")
                                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                                       ON CONFLICT ("documentId", "chunkIndex") DO NOTHING''',
                                    chunks_to_create,
                                    page_size=100
                                )
                                pg_conn.commit()
                                stats.add_chunks(len(chunks_to_create))
                            except Exception as e:
                                pg_conn.rollback()
                                stats.add_error()

                    stats.add_documents(1)
                    stats.add_vectors(len(file_vectors))

                stats.add_batch_processed()

            except Exception as e:
                print(f"  ❌ Error in batch {batch_num}: {e}")
                stats.add_error()
            finally:
                work_queue.task_done()

    except Exception as e:
        print(f"  ❌ Worker error: {e}")
        stats.add_error()
    finally:
        if pg_conn:
            pg_conn.close()


def analyze_current_state(pg_conn):
    """Analyze current state of PostgreSQL"""
    with pg_conn.cursor() as cur:
        cur.execute(f'SELECT COUNT(*) FROM "Document" WHERE "collectionId" = %s', (COLLECTION_ID,))
        doc_count = cur.fetchone()[0]

        cur.execute('SELECT COUNT(*) FROM "DocumentChunk"')
        chunk_count = cur.fetchone()[0]

        cur.execute('SELECT COUNT(*) FROM "DocumentChunk" WHERE "vectorId" IS NOT NULL')
        chunk_with_vector_count = cur.fetchone()[0]

    print(f"\nPostgreSQL Documents: {doc_count}")
    print(f"PostgreSQL Chunks: {chunk_count}")
    print(f"PostgreSQL Chunks with vectorId: {chunk_with_vector_count}")

    return doc_count, chunk_count


def get_qdrant_stats():
    """Get Qdrant collection stats"""
    url = f"{QDRANT_URL}/collections/{COLLECTION_ID}"
    response = requests.get(url)
    response.raise_for_status()

    data = response.json()
    points_count = data.get('result', {}).get('points_count', 0)
    indexed_count = data.get('result', {}).get('indexed_vectors_count', 0)

    print(f"\nQdrant Points: {points_count}")
    print(f"Qdrant Indexed Vectors: {indexed_count}")

    return points_count


def main():
    print("=" * 80)
    print("Qdrant to PostgreSQL Chunk Migration (Multi-threaded, Memory Efficient)")
    print("=" * 80)
    print(f"\nMode: {'DRY RUN (no changes will be made)' if DRY_RUN else 'LIVE (will modify data)'}")
    print(f"Collection: {COLLECTION_ID}")
    print(f"Vector batch size: {VECTOR_BATCH_SIZE}")
    print(f"Parallel threads: {NUM_THREADS}")
    print(f"Max batches in memory: {QUEUE_SIZE}")
    print(f"Max retries: {MAX_RETRIES}")

    if not DRY_RUN:
        response = input("\n⚠️  This will modify data. Are you sure? (yes/no): ")
        if response.lower() != 'yes':
            print("Aborted.")
            return

    # Connect to PostgreSQL
    print("\nConnecting to PostgreSQL...")
    pg_conn = get_pg_connection()
    print("✅ Connected to PostgreSQL")

    print(f"\n=== Analyzing Current State ===")
    doc_count, chunk_count = analyze_current_state(pg_conn)
    qdrant_count = get_qdrant_stats()

    # Initialize stats
    stats = MigrationStats()
    stats.total_vectors = qdrant_count

    print(f"\n=== Starting Migration ===")
    print(f"Processing {qdrant_count:,} vectors with producer-consumer pattern\n")

    # Create work queue and stop event
    work_queue = Queue(maxsize=QUEUE_SIZE)
    stop_event = threading.Event()

    try:
        # Start producer thread
        producer = threading.Thread(target=producer_thread, args=(work_queue, stats, stop_event))
        producer.start()

        # Start worker threads
        workers = []
        for i in range(NUM_THREADS):
            worker = threading.Thread(target=worker_thread, args=(work_queue, stats, stop_event))
            worker.start()
            workers.append(worker)

        # Monitor progress
        last_print = 0
        while producer.is_alive() or not work_queue.empty():
            time.sleep(2)

            # Print progress every 5 batches processed
            if stats.batches_processed >= last_print + 5:
                stats.print_progress()
                last_print = stats.batches_processed

        # Wait for producer to finish
        producer.join()

        # Wait for all workers to finish
        for worker in workers:
            worker.join()

        # Wait for queue to be fully processed
        work_queue.join()

        # Final stats
        print("\n" + "=" * 80)
        print("Migration Complete!")
        print("=" * 80)
        stats.print_progress()

        if DRY_RUN:
            print("\n⚠️  This was a DRY RUN. No changes were made.")
            print("Set DRY_RUN = False in the script to apply changes.")

    except KeyboardInterrupt:
        print("\n\n⚠️  Migration interrupted by user")
        stop_event.set()
        stats.print_progress()
    except Exception as e:
        print(f"\n\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        stop_event.set()
    finally:
        pg_conn.close()
        print("\n✅ Connections closed")


if __name__ == "__main__":
    main()
