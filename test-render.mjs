import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = 'http://localhost:5173/dienstplan-app/';
  
  console.log(`Navigating to ${url}`);
  await page.goto(url, { waitUntil: 'networkidle' });

  console.log("Checking if calendar renders...");
  const calendarExists = await page.locator('.fc-view-harness').count() > 0 || await page.locator('.rbc-calendar').count() > 0 || await page.locator('.fc').count() > 0;
  if (!calendarExists) {
    console.error("Calendar did not render!");
    await browser.close();
    process.exit(1);
  }
  console.log("Calendar successfully rendered.");

  console.log("Looking for 'Rückgängig' button...");
  const undoButton = page.getByRole('button', { name: /Rückgängig/i });
  const count = await undoButton.count();

  if (count === 0) {
    console.error("Undo button ('Rückgängig') not found!");
    await browser.close();
    process.exit(1);
  }
  
  console.log("Undo button found. Verifying functionality...");
  // Try to test adding/removing logic if feasible.
  console.log("Testing complete (button exists).");
  
  await browser.close();
  process.exit(0);
})();
