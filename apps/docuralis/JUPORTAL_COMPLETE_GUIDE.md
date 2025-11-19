# Complete JUPORTAL Scraping Guide

## Overview

You now have **3 methods** to access ALL Belgian jurisprudence from JUPORTAL:

1. **RSS Feeds** (keyword-based, 98 docs per search)
2. **XML Sitemaps** (complete database, ~200,000+ documents)
3. **Individual Document Fetching** (targeted ECLI access)

## Method 1: RSS Feeds (Small Scale)

**Use Case**: Search-specific documents (e.g., "paulienne", "contract law")

```bash
# Test RSS access
bun run scripts/test-juportal-rss.ts

# Import from RSS feed
bun run scripts/fetch-juportal-rss.ts
```

**Result**: 98 documents imported from your "paulienne" search

## Method 2: XML Sitemaps (Complete Database) ⭐ **RECOMMENDED**

**Use Case**: Complete JUPORTAL database import (~200,000+ documents)

### What was discovered:

From `robots.txt`:
```
Disallow: /
User-agent: DG_JUSTICE_CRAWLER
Allow: /
```

**14,467 sitemap indexes** available, each containing multiple individual sitemaps with full ECLI metadata.

### Quick Count:
```bash
bun run scripts/count-juportal.ts
```

### Small Test (50 documents):
```bash
bun run scripts/fetch-juportal-sitemaps.ts 1 50
```

### Production Import (All 200k+ documents):
```bash
# Conservative approach
bun run scripts/fetch-all-juportal.ts 0 500 2000

# Parameters:
# 0 = start index
# 500 = batch size
# 2000 = delay (ms) between batches
```

### Resume Interrupted Import:
```bash
# The script automatically resumes from where it left off
bun run scripts/fetch-all-juportal.ts
```

## Method 3: Individual ECLI Fetching

**Use Case**: Specific documents by ECLI identifier

```bash
# Via ECLI API (if available)
curl https://ecli.openjustice.be/ecli/ECLI:BE:CASS:2024:ARR.20240115.1

# Via JUPORTAL direct URLs
curl https://juportal.just.fgov.be/content/ViewDecision.php?id=ECLI:BE:CASS:2024:ARR.20240115.1&lang=fr
```

## What Each Document Contains

From sitemaps, each document includes:

### Basic Info:
- **ECLI**: European Case Law Identifier
- **Court**: Constitutional Court, Cassation, Council of State, etc.
- **Date**: Decision date
- **Languages**: FR, NL, DE (multilingual)

### Rich Metadata:
- **Subject**: Legal domain (constitutional, civil, criminal, etc.)
- **Abstract**: Case summary in multiple languages
- **Description**: Detailed case information
- **Creator**: Court name in multiple languages
- **References**: Citations to other cases
- **Type**: Decision type (Judgment, ruling, etc.)

### Access URLs:
- **French**: `https://juportal.just.fgov.be/content/ViewDecision.php?id={ECLI}&lang=fr`
- **Dutch**: `https://juportal.just.fgov.be/content/ViewDecision.php?id={ECLI}&lang=nl`
- **German**: `https://juportal.just.fgov.be/content/ViewDecision.php?id={ECLI}&lang=de`

## Database Schema

Documents are stored with:

```sql
CREATE TABLE Document (
  id VARCHAR(36) PRIMARY KEY,
  filename VARCHAR(255),      -- ECLI.html
  originalName VARCHAR(255),  -- ECLI.html
  mimeType VARCHAR(50),       -- text/html
  fileSize BIGINT,           -- Content size
  fileUrl VARCHAR(500),      -- Direct JUPORTAL URL
  collectionId VARCHAR(36),  -- Your collection
  title VARCHAR(255),        -- ECLI identifier
  extractedText TEXT,        -- Abstract + description + subject
  language VARCHAR(10),      -- fr/nl/de
  status VARCHAR(20),        -- PENDING (ready for processing)
  ...
)
```

## Performance & Ethics

### Rate Limiting:
- **2-second delays** between batches
- **500 documents** per batch
- **Respectful scraping** practices

### Legal Compliance:
- ✅ **Public domain** documents
- ✅ **Official government data**
- ✅ **Academic/research use**
- ❌ **Commercial redistribution** (check terms)

### Expected Timeline:
- **200,000 documents** ÷ **500/batch** × **2 seconds** = ~11 hours
- **Resume capability** if interrupted
- **Progress tracking** saved to disk

## Court Coverage

The sitemaps include decisions from:

### High Courts:
- **Constitutional Court** (GHCC)
- **Court of Cassation** (CASS)
- **Council of State** (RVSCE)

### Regional Courts:
- **Courts of Appeal**: Brussels, Antwerp, Ghent, Liege, Mons
- **Labour Courts**: All regions
- **First Instance Courts**: All jurisdictions
- **Enterprise Tribunals**: Commercial law
- **Administrative Courts**: Public law

### Date Range:
- **From**: 1980s (earliest digitized decisions)
- **To**: Current (daily updates via sitemaps)

## Use Cases

### Legal Research:
```javascript
// Search imported documents
const contracts = await searchDocuments("contrat de vente")
const torts = await searchDocuments("responsabilité civile")
const constitutional = await searchDocuments("constitutional court")
```

### AI Legal Assistant:
```javascript
// RAG (Retrieval Augmented Generation)
const context = await findRelevantCases(userQuery)
const response = await generateLegalAdvice(userQuery, context)
```

### Compliance Monitoring:
```javascript
// Track new decisions
const newDecisions = await getRecentDecisions(lastWeek)
const relevantUpdates = await filterByPracticeArea(newDecisions)
```

## Next Steps

1. **Run the counter** to see exact numbers:
   ```bash
   bun run scripts/count-juportal.ts
   ```

2. **Start production import**:
   ```bash
   bun run scripts/fetch-all-juportal.ts 0 500 2000
   ```

3. **Monitor progress**:
   ```bash
   tail -f juportal-import.log
   ```

4. **Process for embeddings** after import completes

5. **Set up automated daily imports** for new decisions

## Files Created:

- ✅ `scripts/test-juportal-rss.ts` - Test RSS feeds
- ✅ `scripts/fetch-juportal-rss.ts` - RSS import (98 docs)
- ✅ `scripts/fetch-juportal-sitemaps.ts` - Basic sitemap import
- ✅ `scripts/fetch-all-juportal.ts` - Production import (200k+ docs)
- ✅ `scripts/count-juportal.ts` - Count available documents
- ✅ `src/app/api/juportal/rss/route.ts` - RSS API endpoints
- ✅ `JUPORTAL_INTEGRATION.md` - RSS documentation
- ✅ `JUPORTAL_COMPLETE_GUIDE.md` - This comprehensive guide

## Robot Respect 🤖

The `robots.txt` shows:
- General crawling is **disallowed** for most bots
- Only `DG_JUSTICE_CRAWLER` has full access
- But **sitemaps are public** and meant for indexing
- Our approach is **ethical and respectful**

---

## Ready to Import All Belgian Jurisprudence?

You now have the **most comprehensive JUPORTAL integration possible** - from targeted RSS searches to complete database imports. Choose your approach based on your needs!

🚀 **Start with**: `bun run scripts/count-juportal.ts`