// ========== QUICK TEST SCRIPT FOR ENHANCED FEATURES ==========
// Run this to test all new features in development
// Usage: node test-features.mjs

import fetch from "node-fetch";

const VK_TOKEN = process.env.VK_TOKEN || "your_token";
const TEST_USER_ID = 123456; // Replace with test user ID
const API_VERSION = "5.131";

async function sendTestMessage(userId, text) {
  console.log(`\n📨 Testing message: "${text}"`);

  const response = await fetch(
    `https://api.vk.com/method/messages.send?user_id=${userId}&message=${encodeURIComponent(text)}&access_token=${VK_TOKEN}&v=${API_VERSION}`,
    { method: "POST" },
  );

  const data = await response.json();
  if (data.response) {
    console.log("✅ Message sent, ID:", data.response);
  } else {
    console.error("❌ Error:", data.error?.error_msg);
  }
}

async function runTests() {
  console.log("🤖 VK Bot Enhanced Features Test Suite");
  console.log("=====================================\n");

  // Test 1: Main Menu Buttons
  console.log("Test 1: Button Navigation");
  console.log("-----------------------");
  await sendTestMessage(TEST_USER_ID, "📅 Schedule");
  await new Promise((r) => setTimeout(r, 1000));
  await sendTestMessage(TEST_USER_ID, "📋 Today");
  await new Promise((r) => setTimeout(r, 1000));
  await sendTestMessage(TEST_USER_ID, "⏭️ What's next?");
  await new Promise((r) => setTimeout(r, 1000));
  await sendTestMessage(TEST_USER_ID, "📊 Statistics");
  await new Promise((r) => setTimeout(r, 1000));

  // Test 2: Natural Language
  console.log("\n\nTest 2: Natural Language Queries");
  console.log("-------------------------------");
  await sendTestMessage(TEST_USER_ID, "What's my schedule today?");
  await new Promise((r) => setTimeout(r, 1000));
  await sendTestMessage(TEST_USER_ID, "What are my tasks?");
  await new Promise((r) => setTimeout(r, 1000));

  // Test 3: Commands
  console.log("\n\nTest 3: Command Format");
  console.log("---------------------");
  await sendTestMessage(TEST_USER_ID, "/add Math 1 10:30 12:05");
  await new Promise((r) => setTimeout(r, 1000));
  await sendTestMessage(TEST_USER_ID, "/deadline Report 2025-12-20 12:00 2");
  await new Promise((r) => setTimeout(r, 1000));

  // Test 4: Settings
  console.log("\n\nTest 4: Settings Menu");
  console.log("--------------------");
  await sendTestMessage(TEST_USER_ID, "⚙️ Settings");
  await new Promise((r) => setTimeout(r, 1000));

  // Test 5: Help
  console.log("\n\nTest 5: Help Menu");
  console.log("----------------");
  await sendTestMessage(TEST_USER_ID, "❓ Help");

  console.log("\n\n✅ All tests completed!");
  console.log("Check bot responses in VK chat");
}

runTests().catch(console.error);
