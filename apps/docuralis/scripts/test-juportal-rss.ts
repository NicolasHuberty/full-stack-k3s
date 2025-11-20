#!/usr/bin/env bun

import Parser from 'rss-parser'

const parser = new Parser()

async function testJUPORTALRSS() {
  console.log('Testing JUPORTAL RSS feeds...\n')

  // Test the specific RSS feed URL you provided
  const testFeeds = [
    {
      name: 'Paulienne Search Results',
      url: 'https://juportal.be/moteur/Flux-RSS.rss?eNqFVMlu2zAQ/ZVA1yCAliiLfKJJ2qIzJgUuSHMKfMihQOEEKHoK8u8dSlZNiqVzk/geOcubeYeubbrP313VdgXVwlr+Y9DcGKFkscLjqiuurj8Of379fDse38aj2xNTc9oj3XJ/WnfF+3GEHwKYUxBW4KdHyq4YCfcBYa8ocBDr+Ik2YGAybr8I0QS4VMsEwtuDW4OgYfQQBSK3EvK3Pb7Rl3GWrW0jODAgz8XqgPjnF75SLnvzMnDGaYaxc8Zy2Dkt2JkRhTAcU5CcB/DjIoTE7mmVy9EzqHI6xJcCniLkCUqzSOGkTMIYJvKUk0EqrSCKEBaB/RF+HFk2h5lBck9MU0Bs/omZQXKNsj03lJgq6PRDCmeF8riz7tJ1hKPrYQFrgkrzLQGeGZUTgRGb7eOJgvPwDYNoGzKaaF2nFmJpa4WaEZlQ1MDHacIzIlliGIaqaVbQWMoEBbEXY3Acj7otyzKdlWEg23nh2wm/i2oAUJN3zQWEcC9AbHsbr3TYA9Or5/9ZzpKDiqHe33JQ1MucvbKJ/S05qAvKklPNMzYCF83MbQdIGosrOsmCvTxLcBctkR/g0Srxov+bV3kjABmvfpWfzn7xbwyblDHamgptrUpJC+NaRkrdM7FeN2s0eXRVR54yjnmNndq5QWlL/OlrXdbtTVXdVI/4WdbNfbH6+gu5YOOR',
    },
  ]

  for (const feedInfo of testFeeds) {
    console.log(`Testing ${feedInfo.name} RSS feed...`)
    console.log(`URL: ${feedInfo.url}`)

    try {
      const feed = await parser.parseURL(feedInfo.url)

      console.log(`✅ Success! Found ${feed.items.length} items`)
      console.log(`  Feed Title: ${feed.title}`)
      console.log(`  Feed Description: ${feed.description}`)

      if (feed.items.length > 0) {
        console.log(`  First item:`)
        console.log(`    Title: ${feed.items[0].title}`)
        console.log(`    Date: ${feed.items[0].pubDate}`)
        console.log(`    Link: ${feed.items[0].link}`)

        // Try to extract ECLI
        const ecliPattern = /ECLI:[A-Z]{2}:[A-Z]+:\d{4}:[A-Z0-9.]+/
        const match =
          (feed.items[0].title || '').match(ecliPattern) ||
          (feed.items[0].description || '').match(ecliPattern)
        if (match) {
          console.log(`    ECLI: ${match[0]}`)
        }
      }
    } catch (error) {
      console.error(`❌ Error: ${error}`)
    }

    console.log()
  }
}

testJUPORTALRSS().catch(console.error)
