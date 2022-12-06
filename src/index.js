import { parse } from 'node-html-parser';
import path from 'path';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const main = async () => {
  try {
    const response = await fetch('https://proxy.atomscan.com/directory/_IBC/');
    const rawHTML = await response.text();
    const root = parse(rawHTML);
    const elements = root.querySelectorAll('.line > a[href$=".json"]');
    const ibcSupport = {};
    const hrefs = [];
    elements.forEach((element) => {
      const href = element.getAttribute('href');
      if (href) {
        hrefs.push(href);
        const [src, dest] = href.slice(0, -5).split('-');
        if (ibcSupport[src]) {
          ibcSupport[src][dest] = true;
        } else {
          ibcSupport[src] = { [dest]: true };
        }
        if (ibcSupport[dest]) {
          ibcSupport[dest][src] = true;
        } else {
          ibcSupport[dest] = { [src]: true };
        }
      }
    });
    const allData = Object.entries(ibcSupport).reduce((acc, [key, value]) => {
      return {
        ...acc,
        [key]: Object.keys(value),
      };
    }, {});
    const data = JSON.stringify(allData);
    await fs.writeFile(path.join(__dirname, '../data/all.json'), data);
    await Promise.all(
      hrefs.map(async (href) => {
        const res = await fetch(
          `https://proxy.atomscan.com/directory/_IBC/${href}`
        );
        const data = await res.json();
        await fs.writeFile(
          path.join(__dirname, '../data/', href),
          JSON.stringify(data)
        );
      })
    );
    console.log('CRON Success');
  } catch (err) {
    console.log('CRON Error', err);
  }
};

main();
