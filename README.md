# IBC Support DB

This is a Cloudflare worker. It has a CRON setup to fetch latest IBC support data from https://proxy.atomscan.com/directory/_IBC. Data is updated every midnight and can be queried directly form the worker.

Make a request at / to get an object of type <src_chain, dest_chain[]>

Make a request at /src_chain-dest_chain to get information related to channel IDs

Make a request at /chain to get a list of chains that can receive tokens via IBC from `chain`
