#!/usr/bin/env bun

const ECLI_API_BASE = 'https://ecli.openjustice.be'

async function testECLIAPI() {
  console.log('Testing ECLI API endpoints...\n')

  const testCases = [
    {
      name: 'Council of State',
      ecli: 'ECLI:BE:RVSCDE:2020:247.760'
    },
    {
      name: 'Constitutional Court',
      ecli: 'ECLI:BE:CC:2020:141'
    },
    {
      name: 'Court of Cassation',
      ecli: 'ECLI:BE:CASS:2021:ARR.20211125.1'
    }
  ]

  for (const test of testCases) {
    console.log(`Testing ${test.name} (${test.ecli})...`)

    try {
      // Test JSON endpoint
      const jsonResponse = await fetch(`${ECLI_API_BASE}/ecli/${test.ecli}`, {
        headers: {
          'Accept': 'application/json'
        }
      })

      console.log(`  JSON Response: ${jsonResponse.status} ${jsonResponse.statusText}`)

      if (jsonResponse.ok) {
        const data = await jsonResponse.json()
        console.log(`  Data keys: ${Object.keys(data).join(', ')}`)
      }

      // Test HTML endpoint
      const htmlResponse = await fetch(`${ECLI_API_BASE}/ecli/${test.ecli}`, {
        headers: {
          'Accept': 'text/html'
        }
      })

      console.log(`  HTML Response: ${htmlResponse.status} ${htmlResponse.statusText}`)

    } catch (error) {
      console.error(`  Error: ${error}`)
    }

    console.log()
  }

  // Test base API endpoint
  console.log('Testing base API endpoint...')
  try {
    const baseResponse = await fetch(ECLI_API_BASE)
    console.log(`Base API Response: ${baseResponse.status} ${baseResponse.statusText}`)
  } catch (error) {
    console.error(`Error accessing base API: ${error}`)
  }
}

testECLIAPI().catch(console.error)