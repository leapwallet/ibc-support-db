import { parse } from 'node-html-parser';
import path from 'path';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);
const PINGPUB_BASEURL = 'https://registry.ping.pub/_IBC/';
const ATOMSCAN_BASEURL = 'https://proxy.atomscan.com/directory/_IBC/';
const COSMOS_CHAIN_REGISTRY_BASE_URL =
  'https://github.com/cosmos/chain-registry/tree/master/_IBC';

async function fetchFromAtomScan() {
  const response = await fetch(ATOMSCAN_BASEURL);
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

  return {
    baseUrl: ATOMSCAN_BASEURL,
    hrefs,
    ibcSupport,
  };
}

async function fetchFromPingPub() {
  const response = await fetch(PINGPUB_BASEURL);
  const ibcData = await response.json();
  const hrefs = ibcData
    .filter((file) => file.name)
    .map((file) => {
      return file.name;
    });
  const ibcSupport = {};
  hrefs.forEach((href) => {
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
  });

  return {
    baseUrl: PINGPUB_BASEURL,
    hrefs,
    ibcSupport,
  };
}

async function fetchFromCosmosChainRegistry() {
  const response = await fetch(COSMOS_CHAIN_REGISTRY_BASE_URL);
  const ibcData = await response.json();
  const hrefs = ibcData.payload.tree.items
    .filter(
      (file) =>
        file.contentType === 'file' &&
        file.path?.startsWith('_IBC/') &&
        file.name
    )
    .map((file) => {
      return file.name;
    });

  const ibcSupport = {};

  hrefs.forEach((href) => {
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
  });

  return {
    baseUrl:
      'https://raw.githubusercontent.com/cosmos/chain-registry/master/_IBC',
    hrefs,
    ibcSupport,
  };
}

const main = async () => {
  try {
    const { baseUrl, ibcSupport, hrefs } = await fetchFromCosmosChainRegistry();
    const allData = Object.entries(ibcSupport).reduce((acc, [key, value]) => {
      return {
        ...acc,
        [key]: Object.keys(value),
      };
    }, {});
    const data = JSON.stringify(allData);
    await fs.writeFile(path.join(__dirname, '../data/all.json'), data);
    await Promise.all(
      Object.entries(allData).map(([chain, ibcList]) => {
        return fs.writeFile(
          path.join(__dirname, '../data/chains', `${chain}.json`),
          JSON.stringify(ibcList)
        );
      })
    );
    await Promise.all(
      hrefs.map(async (href) => {
        const res = await fetch(`${baseUrl}/${href}`);
        const data = await res.json();
        return fs.writeFile(
          path.join(__dirname, '../data/pairs', href),
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
