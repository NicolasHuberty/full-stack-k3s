# JUPORTAL Integration Guide

This document explains how to access and import Belgian jurisprudence from JUPORTAL into your Docuralis collection.

## What is JUPORTAL?

JUPORTAL is Belgium's public database of jurisprudence that replaced the Jure-Juridat search engine in November 2020. It contains case law from:

- Constitutional Court
- Court of Cassation
- Council of State
- Courts of Appeal (Brussels, Antwerp, Ghent, Liege, Mons)
- Labour Courts
- First Instance Courts
- Enterprise Tribunals

## Access Methods

### 1. RSS Feeds (Recommended)

JUPORTAL generates RSS feed URLs based on search parameters. This is the most reliable method to fetch jurisprudence documents.

#### How to get an RSS feed URL:

1. Go to [JUPORTAL](https://juportal.be)
2. Perform your search (e.g., search for "paulienne")
3. Configure your filters (court, date range, language, etc.)
4. Click "Sauvegarder flux RSS" (Save RSS Feed)
5. Copy the generated RSS URL

#### Example RSS URLs:

```
# Search for "paulienne" in all texts
https://juportal.be/moteur/Flux-RSS.rss?eNqFVMlu2zAQ/ZVA1yCAliiLfKJJ2qIzJgUuSHMKfMihQOEEKHoK8u8dSlZNiqVzk/geOcubeYeubbrP313VdgXVwlr+Y9DcGKFkscLjqiuurj8Of379fDse38aj2xNTc9oj3XJ/WnfF+3GEHwKYUxBW4KdHyq4YCfcBYa8ocBDr+Ik2YGAybr8I0QS4VMsEwtuDW4OgYfQQBSK3EvK3Pb7Rl3GWrW0jODAgz8XqgPjnF75SLnvzMnDGaYaxc8Zy2Dkt2JkRhTAcU5CcB/DjIoTE7mmVy9EzqHI6xJcCniLkCUqzSOGkTMIYJvKUk0EqrSCKEBaB/RF+HFk2h5lBck9MU0Bs/omZQXKNsj03lJgq6PRDCmeF8riz7tJ1hKPrYQFrgkrzLQGeGZUTgRGb7eOJgvPwDYNoGzKaaF2nFmJpa4WaEZlQ1MDHacIzIlliGIaqaVbQWMoEBbEXY3Acj7otyzKdlWEg23nh2wm/i2oAUJN3zQWEcC9AbHsbr3TYA9Or5/9ZzpKDiqHe33JQ1MucvbKJ/S05qAvKklPNMzYCF83MbQdIGosrOsmCvTxLcBctkR/g0Srxov+bV3kjABmvfpWfzn7xbwyblDHamgptrUpJC+NaRkrdM7FeN2s0eXRVR54yjnmNndq5QWlL/OlrXdbtTVXdVI/4WdbNfbH6+gu5YOOR
```

### 2. ECLI API (Alternative)

There's an open-source ECLI API available at https://ecli.openjustice.be, but it may have limited availability.

## Using the Integration

### Command Line Scripts

#### 1. Test RSS Feed Access

```bash
bun run scripts/test-juportal-rss.ts
```

#### 2. Import Documents from RSS

```bash
bun run scripts/fetch-juportal-rss.ts
```

This script will:

- Get an existing user from the database
- Create a "JUPORTAL Jurisprudence RSS" collection if it doesn't exist
- Fetch documents from the configured RSS feeds
- Store them in the database with proper metadata

### API Endpoints

#### 1. Get RSS Feed Information

```
GET /api/juportal/rss
```

Returns available predefined feeds and their descriptions.

#### 2. Fetch Documents from RSS Feed

```
GET /api/juportal/rss?url={RSS_FEED_URL}
```

Fetches and returns documents from a specific RSS feed without importing them.

#### 3. Import RSS Feed into Collection

```
POST /api/juportal/rss
Content-Type: application/json

{
  "feedUrl": "https://juportal.be/moteur/Flux-RSS.rss?...",
  "collectionId": "your-collection-id"
}
```

Imports documents from the RSS feed into your specified collection.

### Response Format

Documents include:

- **ECLI**: European Case Law Identifier
- **Title**: Case title
- **Link**: Direct link to JUPORTAL document
- **Publication Date**: When the decision was published
- **Content**: Full text or summary of the decision
- **Court Information**: Which court issued the decision

## Example Usage

### 1. Create a Search on JUPORTAL

1. Go to https://juportal.be
2. Search for "contrat de vente" (sales contract)
3. Filter by Court of Cassation decisions from 2020-2024
4. Save as RSS feed
5. Copy the RSS URL

### 2. Import into Your Collection

```bash
curl -X POST http://localhost:3000/api/juportal/rss \
  -H "Content-Type: application/json" \
  -d '{
    "feedUrl": "YOUR_RSS_URL_HERE",
    "collectionId": "YOUR_COLLECTION_ID"
  }'
```

### 3. Use in Your Application

Once imported, the documents will be:

- Searchable through your collection
- Available for AI-powered analysis
- Integrated with your document management system

## Search Categories

You can create RSS feeds for specific legal domains:

- **Contract Law**: Search for "contrat", "vente", "achat"
- **Tort Law**: Search for "responsabilité", "dommages"
- **Family Law**: Search for "divorce", "pension alimentaire"
- **Commercial Law**: Search for "société", "faillite", "concurrence"
- **Real Estate**: Search for "propriété", "hypothèque", "servitude"
- **Action Paulienne**: Search for "paulienne" (as in your example)

## Data Structure

Each imported document contains:

- **filename**: ECLI identifier + .html
- **title**: Case title or ECLI if no title
- **fileUrl**: Direct link to JUPORTAL
- **extractedText**: Full decision text
- **status**: PENDING (ready for processing)

## Limitations

1. **Rate Limiting**: Be respectful with RSS feed requests
2. **Content Rights**: Respect JUPORTAL's terms of service
3. **Language**: Documents are in French, Dutch, or German
4. **Updates**: RSS feeds reflect new decisions, not updates to existing ones

## Next Steps

After importing documents:

1. Process them for embeddings (vector search)
2. Set up automated imports for specific searches
3. Create specialized collections by legal domain
4. Integrate with your AI legal assistant

## Contact

For official API access to JUPORTAL, contact:

- **SPF Justice**: info@just.fgov.be
- **JUPORTAL Support**: Through the official website

For technical issues with this integration, check the application logs and ensure your RSS URLs are valid.
