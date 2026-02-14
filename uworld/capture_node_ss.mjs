import puppeteer from "puppeteer";
const browser = await puppeteer.connect({"browserURL": "http://localhost:9222", "defaultViewport": null});
const pages = await browser.pages();

// const far_url = "far_etextbook_url";
// const page = pages.find(p => p.url().includes(far_url))
// const folder = 'far';
// const pageCount = 528;

const aud_url = "aud_etextbook_url";
const page = pages.find(p => p.url().includes(aud_url))
const folder = 'aud';
const pageCount = 662;

console.log(page.url());
const page_down = await page.waitForSelector('i[title="Page Down"].fal.fa-arrow-down.ml-3');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < pageCount; i++) {
    const el = await page.waitForSelector(`#div-lecture-${i}.lecture-page.ng-star-inserted`, {"visible": true});
    el.scrollIntoView();
    await el.screenshot({ path: `${folder}/${i}.png`});
    await page_down.click();
    await sleep(100);
}
await browser.disconnect();
