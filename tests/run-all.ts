/**
 * Test Runner Configuration
 * 
 * This file can be used to run all tests in a specific order
 * or configure test environments for different scenarios.
 */

// Import all test suites (order matters for some integration tests)
import "./instructions/initialize-escrow.test";
import "./instructions/release-payment.test";
import "./instructions/claim-payment.test";
import "./instructions/initialize-freelancer-badge.test";
import "./instructions/update-freelancer-badge.test";
import "./integration/escrow-flow.test";

console.log("🧪 Running Bondr test suite...");
console.log("📁 Test organization:");
console.log("  ├── utils/ - Shared test utilities");
console.log("  ├── instructions/ - Individual instruction tests");
console.log("  └── integration/ - End-to-end flow tests"); 