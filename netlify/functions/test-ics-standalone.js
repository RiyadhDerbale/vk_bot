
// test-ics-standalone.js - Run this to test if ICS import works at all
import fetch from 'node-fetch';
import ical from 'ical';
import fs from 'fs';

async function testICSImport() {
  console.log("=".repeat(60));
  console.log("🧪 TESTING ICS IMPORT FUNCTION");
  console.log("=".repeat(60));
  
  const testUrl = "https://raw.githubusercontent.com/ical-org/ical.js/master/test/calendars/event.ics";
  
  console.log(`\n📥 Testing URL: ${testUrl}`);
  
  try {
    // Step 1: Download
    console.log("⏳ Downloading...");
    const response = await fetch(testUrl);
    console.log(`✅ Status: ${response.status}`);
    
    // Step 2: Get text
    const text = await response.text();
    console.log(`✅ Size: ${text.length} bytes`);
    console.log(`✅ First 200 chars: ${text.substring(0, 200)}`);
    
    // Step 3: Check if it's ICS
    if (text.includes('BEGIN:VCALENDAR')) {
      console.log("✅ Valid ICS format detected");
    } else {
      console.log("❌ NOT a valid ICS file");
      return;
    }
    
    // Step 4: Parse with ical
    console.log("\n⏳ Parsing with ical library...");
    const parsed = ical.parseICS(text);
    console.log(`✅ Parsed ${Object.keys(parsed).length} components`);
    
    // Step 5: Find events
    let eventCount = 0;
    for (const key in parsed) {
      const event = parsed[key];
      if (event.type === 'VEVENT') {
        eventCount++;
        console.log(`\n📅 Event ${eventCount}: ${event.summary}`);
        console.log(`   Start: ${event.start}`);
        console.log(`   End: ${event.end}`);
      }
    }
    
    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ SUCCESS! Found ${eventCount} events`);
    console.log(`✅ ICS import function is WORKING`);
    console.log(`${"=".repeat(60)}`);
    
  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    console.error(error.stack);
  }
}

// Run the test
testICSImport();